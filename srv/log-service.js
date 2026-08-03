const cds = require('@sap/cds');
const { applyModificationPayload } = require('./utils/modification');

module.exports = cds.service.impl(async function () {
    const { attachReadOnlyGuard } = require('./utils/read-only-guard');
    attachReadOnlyGuard(this);

    const { AppLogs } = this.entities;

    this.on('logEvent', async (req) => {
        try {
            const {
                aplicativo,
                usuario,
                accion,
                datosPrevios,
                datosNuevos,
                ticket,
                proveedor,
                estado
            } = req.data;

            await INSERT.into(AppLogs).entries({
                app,
                user: usuario || req.user.id,
                modification,
                previous_data: previous_data || null,
                new_data: new_data || null,
                ticket_ID: ticket,
                business_partner_ID: business_partner,
                result: result || 'INFO',
            });

            return "Log registrado con éxito";

        } catch (err) {
            console.error("Error en LogService.logEvent:", err.message);
            return req.error(500, `No se pudo guardar el log: ${err.message}`);
        }
    });

    this.on('endWorkflowPrecert', async (req) => {
        try {
            const { ticket_ID, status, comments, hes_number, workflow_instance_id, location, POItem } = req.data;
            const { PrecertTickets, ApplicationLogs } = cds.entities;

            const ticket = await SELECT.one.from(PrecertTickets).where({ ID: ticket_ID });
            if (!ticket) return req.reject(404, 'Ticket not found');

            const newStatus = status === "SUCCESS" ? "APROBADO" : "ERROR_WF";
            const isWfError = status === 'ERROR_WF';

            // ── Determinar el campo correcto según el tipo de origen ──────────────
            // PO/OC: POItem que llega del WF coincide con po_item (posición real de la OC)
            // PC/CM: POItem que llega del WF es el PRItem de la SolPed (10,20,30...),
            //        no po_item (que guarda la posición real del contrato, ej. 180)
            const sItemField = ticket.source_type === "PC" ? "pr_item" : "po_item";
            const vItemValue = ticket.source_type === "PC" ? String(POItem) : parseInt(POItem);

            let province_ID_filter = null;
            if (location) {
                const aProvinces = await SELECT
                    .from('suppliersInitiative.Provinces')
                    .columns('ID', 's4_code', 'description');

                const matched = aProvinces.find(p => {
                    const desc = (p.description || "").trim();
                    const code = String(p.s4_code || "").trim().padStart(2, '0');
                    const id = (p.ID || "").trim();
                    const loc = (location || "").trim();
                    const locL = loc.toLowerCase();

                    return (
                        `${code} ${desc}`.toLowerCase() === locL ||  // "02 Catamarca"
                        desc.toLowerCase() === locL ||  // "Catamarca"
                        `${desc} ${desc}`.toLowerCase() === locL ||  // "Catamarca Catamarca"
                        id.toLowerCase() === locL     // "Cat"
                    );
                });

                province_ID_filter = matched?.ID || null;

                if (!province_ID_filter) {
                    console.warn(`[endWorkflowPrecert] No se pudo resolver location="${location}" a province_ID`);
                }
            }


            let subIds = [];
            let exactSubIds = [];   // ← match preciso por po_item+province, sin fallback "todos los del WF"

            if (workflow_instance_id) {
                const wfRows = await SELECT
                    .from('suppliersInitiative.WorkflowStatus')
                    .columns('precert_ticket_ID')
                    .where({ workflow_instance_id });

                const allWfSubIds = wfRows.map(r => r.precert_ticket_ID).filter(Boolean);

                if (allWfSubIds.length) {
                    const oWhere = { ID: { in: allWfSubIds } };
                    if (POItem) oWhere[sItemField] = vItemValue;
                    if (province_ID_filter) oWhere.province_ID = province_ID_filter;  // ← ID resuelto

                    const aFiltered = await SELECT
                        .from(PrecertTickets)
                        .columns('ID')
                        .where(oWhere);

                    exactSubIds = aFiltered.map(s => s.ID);
                    subIds = exactSubIds;

                    if (!subIds.length) {
                        console.warn(
                            `[endWorkflowPrecert] Filtro ${sItemField}=${vItemValue} / province_ID=${province_ID_filter}` +
                            ` (location="${location}") sin resultados, usando todos los del WF`
                        );
                        subIds = allWfSubIds;
                    }
                }
            }

            // Fallback: si no vino workflow_instance_id
            if (!subIds.length) {
                console.warn(`[endWorkflowPrecert] Sin workflow_instance_id, actualizando todos los subs de ${ticket_ID}`);
                const oWhere = { parent_ticket_ID: ticket_ID };
                if (POItem) oWhere[sItemField] = vItemValue;
                if (province_ID_filter) oWhere.province_ID = province_ID_filter;

                const subs = await SELECT.from(PrecertTickets).columns('ID').where(oWhere);
                subIds = subs.map(s => s.ID);
                exactSubIds = subIds;
            }

            // ── Propagar hes_number ───────────────────────────────────────────────
            // Un mismo workflow_instance_id puede generar varias HES (una por grupo
            // provincia/po_item). Para esto se usa exactSubIds (match preciso por
            // po_item+province), NUNCA el fallback "todos los del WF" — ese fallback
            // es el que hacía que una HES pisara el hes_number de otro grupo.
            if (hes_number && exactSubIds.length && !isWfError) {
                await UPDATE(PrecertTickets)
                    .set({ hes_number })
                    .where({ ID: { in: exactSubIds } });
            } else if (hes_number && !isWfError) {
                console.warn(
                    `[endWorkflowPrecert] No se pudo determinar el subticket exacto para HES ${hes_number}` +
                    ` (${sItemField}=${vItemValue}, location=${location}) — no se asigna para evitar pisar otro grupo.`
                );
            }

            // ── Actualizar WorkflowStatus ─────────────────────────────────────────
            if (subIds.length) {
                if (isWfError) {
                    await UPDATE('suppliersInitiative.WorkflowStatus')
                        .set({
                            status: 'ERROR_WF',
                            description: `Error en workflow S4: ${comments || 'Sin comentarios'}`
                        })
                        .where({ precert_ticket_ID: { in: subIds } });
                } else {
                    await UPDATE('suppliersInitiative.WorkflowStatus')
                        .set({
                            status: 'APROBADO',
                            description: `HES ${hes_number || 'N/A'} - ${comments || 'Sin comentarios'}`
                        })
                        .where({ precert_ticket_ID: { in: subIds } });
                }
            }

            // ── Logs ──────────────────────────────────────────────────────────────
            await INSERT.into(ApplicationLogs).entries({
                app: 'Precertificacion',
                modification: isWfError ? 'WF_ERROR' : 'WF_FINISHED',
                description: !isWfError
                    ? `Workflow finalizado por ${req.user.id}. HES ${hes_number || 'N/A'} creada para ${subIds.length} subticket/s. ${sItemField}: ${POItem || 'N/A'}. Location: ${location || 'N/A'} → province_ID: ${province_ID_filter || 'N/A'}. WF Instance: ${workflow_instance_id || 'N/A'}. Status: ${status}. Comentarios: ${comments || 'Sin comentarios'}`
                    : `Error en workflow S4: ${comments || 'Sin comentarios'}`,
                ticket_display: String(ticket.ticket_number || 'N/A'),
                result: status === "SUCCESS" ? 'SUCCESS' : 'ERROR'
            });

            return {
                message: "Precert ticket approved successfully",
                hes_number,
                updated_subtickets: subIds.length,
                status: newStatus
            };

        } catch (err) {
            console.error(`[endWorkflowPrecert] Error inesperado:`, err.message, err.stack);
            return req.reject(500, `Error interno en endWorkflowPrecert: ${err.message}`);
        }
    });

    this.on('endWorkflowSolicitudSolped', async (req) => {
        const { ticket_ID, status, comments, workflow_instance_id, pr_number, approved_pr_items } = req.data;
        const { PrecertTickets, ApplicationLogs } = cds.entities;

        const ticket = await SELECT.one.from(PrecertTickets).where({ ID: ticket_ID });
        if (!ticket) return req.reject(404, 'Ticket not found');

        // ── Buscar subtickets del grupo por workflow_instance_id ──────────────────
        let subIds = [];

        if (workflow_instance_id) {
            const wfRows = await SELECT
                .from('suppliersInitiative.WorkflowStatus')
                .columns('precert_ticket_ID')
                .where({ workflow_instance_id });

            subIds = wfRows.map(r => r.precert_ticket_ID).filter(Boolean);
        }

        if (!subIds.length) {
            console.warn(`[endWorkflowSolicitudSolped] Sin workflow_instance_id, actualizando todos los subs de ${ticket_ID}`);
            const subs = await SELECT
                .from(PrecertTickets)
                .columns('ID')
                .where({ parent_ticket_ID: ticket_ID });
            subIds = subs.map(s => s.ID);
        }

        const isWfError = status === 'ERROR_WF';

        // ── CAPA 1: filtrar por approved_pr_items si BPA los envía ───────────────
        let approvalSubIds = [...subIds];

        if (!isWfError && Array.isArray(approved_pr_items) && approved_pr_items.length) {
            const matchingSubs = await SELECT
                .from(PrecertTickets)
                .columns('ID')
                .where({
                    ID: { in: subIds },
                    po_item: { in: approved_pr_items.map(Number) }
                });
            approvalSubIds = matchingSubs.map(s => s.ID);

            if (!approvalSubIds.length) {
                console.warn(`[endWorkflowSolicitudSolped] approved_pr_items no matcheó ningún subticket, usando subIds completos`);
                approvalSubIds = [...subIds];
            }
        }

        // ── CAPA 2: solo actualizar los que están en ENVIANDO_SOLPED ─────────────
        if (!isWfError && approvalSubIds.length) {
            const eligibleRows = await SELECT
                .from('suppliersInitiative.WorkflowStatus')
                .columns('precert_ticket_ID')
                .where({
                    precert_ticket_ID: { in: approvalSubIds },
                    status: 'ENVIANDO_SOLPED'
                });

            const eligibleIds = eligibleRows.map(r => r.precert_ticket_ID);

            if (!eligibleIds.length) {
                console.warn(`[endWorkflowSolicitudSolped] Ningún subticket elegible en ENVIANDO_SOLPED para ticket ${ticket_ID}`);
            }

            approvalSubIds = eligibleIds;
        }

        // ── Propagar pr_number solo a los elegibles ───────────────────────────────
        if (pr_number && approvalSubIds.length && !isWfError) {
            await UPDATE(PrecertTickets)
                .set({ solped_number: pr_number })
                .where({ ID: { in: approvalSubIds } });
        }

        // ── Actualizar WorkflowStatus ─────────────────────────────────────────────
        if (isWfError && subIds.length) {
            await UPDATE('suppliersInitiative.WorkflowStatus')
                .set({
                    status: 'ERROR_WF',
                    description: `Error en workflow S4: ${comments || 'Sin comentarios'}`
                })
                .where({ precert_ticket_ID: { in: subIds } });

        } else if (!isWfError && approvalSubIds.length) {
            // PC → ENVIANDO_HES (solped creada, ahora espera proceso HES)
            // SO, MA → APROBADO
            const statusMap = {
                'PC': 'ENVIANDO_HES',
                'SO': 'APROBADO',
                'MA': 'APROBADO'
            };
            const newStatus = statusMap[ticket.source_type];

            if (newStatus) {
                await UPDATE('suppliersInitiative.WorkflowStatus')
                    .set({
                        status: newStatus,
                        description: `PR/Solped ${pr_number || 'N/A'} - ${comments || 'Sin comentarios'}`
                    })
                    .where({ precert_ticket_ID: { in: approvalSubIds } });
            }
        }

        // ── Logs ──────────────────────────────────────────────────────────────────
        await INSERT.into(ApplicationLogs).entries({
            app: 'Solicitud Solped',
            modification: isWfError ? 'WF_ERROR' : 'WF_FINISHED',
            description: `Workflow finalizado por ${req.user.id}. PR/Solped ${pr_number || 'N/A'} creada para ${approvalSubIds.length} subticket/s (de ${subIds.length} en el grupo). WF Instance: ${workflow_instance_id || 'N/A'}. Status: ${status}. Comentarios: ${comments || 'Sin comentarios'}`,
            ticket_display: String(ticket.ticket_number || 'N/A'),
            result: status === 'SUCCESS' ? 'SUCCESS' : 'ERROR'
        });

        return {
            message: isWfError ? 'Workflow error from S4' : 'Solped ticket updated successfully',
            pr_number,
            updated_subtickets: approvalSubIds.length,
            total_in_group: subIds.length,
            status: status === 'SUCCESS' ? 'APROBADO' : isWfError ? 'ERROR_WF' : 'ERROR_SOLPED'
        };
    });

    // ─── endWorkflowABM ───────────────────────────────────────────────────
    // Callback de fin de WF (BPA) tanto para ALTA como para MODIFICACIÓN (impuestos/tesorería).
    // En una modificación exitosa aplica el borrador PENDIENTE al BP local (apply-on-success)
    // y cierra el WorkflowStatus de la modif; en un alta persiste el número S/4 y cierra el WF ABM.
    // ─────────────────────────────────────────────────────────────────────
    this.on('endWorkflowABM', async (req) => {
        try {
            const { bp_id, status, s4_business_partner, comments, workflow_instance_id } = req.data;

            if (!bp_id) return req.reject(400, 'bp_id es obligatorio');

            const { ApplicationLogs } = cds.entities;

            const bp = await SELECT.one.from('suppliersInitiative.BusinessPartners').where({ ID: bp_id });
            if (!bp) {
                console.warn(`[endWorkflowABM] ⚠ BP ${bp_id} no encontrado → rechazando`);
                return req.reject(404, `Business Partner ${bp_id} no encontrado`);
            }

            // Detección de modificación: si el BP tiene un WorkflowStatus de modificación
            // activo (PENDIENTE/APROBADO), este callback corresponde a una modif y no a un alta.
            // El área se identifica por el workflow_instance_id del callback, que apunta
            // sin ambigüedad a la WF que se está finalizando. Sin esto, un WorkflowStatus
            // viejo de otra área (p. ej. una modif de tesorería previa aún en PENDIENTE)
            // podía ser elegido por el SELECT.one y etiquetar mal la modificación.
            const modifWf = workflow_instance_id
                ? await SELECT.one.from('suppliersInitiative.WorkflowStatus')
                    .columns('application_type')
                    .where({
                        business_partner_ID: bp_id,
                        application_type: { in: ['MODIF_IMPUESTOS', 'MODIF_TESORERIA'] },
                        workflow_instance_id
                    })
                : await SELECT.one.from('suppliersInitiative.WorkflowStatus')
                    .columns('application_type')
                    .where({
                        business_partner_ID: bp_id,
                        application_type: { in: ['MODIF_IMPUESTOS', 'MODIF_TESORERIA'] },
                        status: { in: ['PENDIENTE', 'APROBADO'] }
                    });
            const areaCodeOf = t => t === 'MODIF_IMPUESTOS' ? 'TAX' : t === 'MODIF_TESORERIA' ? 'TESO' : null;
            const areaLabelOf = c => c === 'TAX' ? 'impuestos' : c === 'TESO' ? 'tesorería' : null;

            const modifAreaCode = areaCodeOf(modifWf?.application_type);
            const modifAreaLabel = areaLabelOf(modifAreaCode);
            const isModif = !!modifAreaCode;

            const isError = status === 'ERROR_WF' || !s4_business_partner;

            // Callback huérfano: cada submit/resubmit/approve de una modificación arranca una
            // instancia BPA nueva y la fila MODIF_* guarda sólo la última, así que una instancia
            // vieja que cierre después llega acá con un workflow_instance_id que ya no matchea
            // ninguna fila. Sin este guard caía en la rama de ALTA y logueaba "BP creado en S4"
            // (S4_CREATED) para un BP que ya existía, además de pisar el WorkflowStatus del alta
            // y re-promover el usuario en IAS. Si el alta ya está cerrada (BP con número S/4 y WF
            // ABM FINALIZADO), este callback no puede ser de un alta → se registra y no se toca nada.
            const abmWf = await SELECT.one.from('suppliersInitiative.WorkflowStatus')
                .columns('status')
                .where({ business_partner_ID: bp_id, application_type: 'ABM' });

            if (!isModif && bp.business_partner_number && abmWf?.status === 'FINALIZADO') {
                // ¿A qué pedido corresponde? Aunque el instance id no matchee, si el BP tiene una
                // modificación en curso el callback es de ESE pedido (de una instancia anterior del
                // mismo WF), así que el log lo nombra como el cierre de ESE pedido y no como algo genérico.
                const activeModif = await SELECT.one.from('suppliersInitiative.WorkflowStatus')
                    .columns('application_type', 'status')
                    .where({
                        business_partner_ID: bp_id,
                        application_type: { in: ['MODIF_IMPUESTOS', 'MODIF_TESORERIA'] },
                        status: { in: ['PENDIENTE', 'APROBADO'] }
                    });
                const staleAreaCode = areaCodeOf(activeModif?.application_type);
                const staleAreaLabel = areaLabelOf(staleAreaCode);

                // Éxito huérfano → no aporta nada (el alta ya está cerrada y el WF bueno de la
                // modificación cierra por su cuenta): se deja rastro y no se toca ningún dato.
                if (!isError) {
                    console.warn(`[endWorkflowABM] ⚠ Callback de instancia anterior para BP ${bp_id}, instance ${workflow_instance_id || 'N/A'}, área ${staleAreaCode || 'N/A'} → sin efecto`);

                    // Con un pedido de modificación en curso el callback es de una instancia
                    // anterior de ESE pedido: no modificó ningún dato y el WF vigente lo cierra
                    // por su cuenta. Cada submit/resubmit/approve deja una de estas, así que en
                    // el log de la app son varias filas seguidas que sólo confunden al usuario
                    // (parecen cierres del pedido y no lo son). El rastro queda en el console.warn
                    // de arriba, que es donde sirve. Sin pedido en curso SÍ se registra: ahí el
                    // callback no matchea nada y es una anomalía que hay que poder ver.
                    if (!staleAreaCode) {
                        await INSERT.into(ApplicationLogs).entries({
                            app: 'ABM Contratistas',
                            modification: 'WF_CALLBACK_SIN_WORKFLOW',
                            description: `Cierre de WF sin pedido asociado para BP: ${bp.provider_name || bp_id}. El alta ya estaba finalizada (BP ${bp.business_partner_number}) y no hay ningún pedido de modificación en curso que coincida con la WF Instance: ${workflow_instance_id || 'N/A'}. No se modificó ningún dato.`.slice(0, 500),
                            ticket_display: bp.business_partner_number,
                            business_partner_ID: bp_id,
                            result: 'WARNING'
                        });
                    }

                    return { bp_id, s4_business_partner: bp.business_partner_number, status: 'FINALIZADO' };
                }

                // Error huérfano → la falla no se pierde: se imputa al pedido de modificación en
                // curso (si lo hay) y NUNCA al WorkflowStatus del alta, que ya está finalizado.
                if (staleAreaCode) {
                    await UPDATE('suppliersInitiative.WorkflowStatus')
                        .set({
                            status: 'ERROR_WF',
                            description: `Error aplicando la modificación de ${staleAreaLabel} en S/4: ${comments || 'Sin comentarios'}`
                        })
                        .where({ business_partner_ID: bp_id, application_type: activeModif.application_type });
                }

                console.warn(`[endWorkflowABM] ⚠ Callback huérfano (error) para BP ${bp_id}, instance ${workflow_instance_id || 'N/A'}`);

                await INSERT.into(ApplicationLogs).entries({
                    app: 'ABM Contratistas',
                    modification: staleAreaCode ? `${staleAreaCode}_MODIF_ERROR` : 'WF_ERROR',
                    description: (staleAreaCode
                        ? `Error aplicando la modificación de ${staleAreaLabel} en S4 para BP: ${bp.provider_name || bp_id}: ${comments || 'Sin comentarios'}. WF Instance: ${workflow_instance_id || 'N/A'} (no coincide con la instancia registrada; el alta ya estaba finalizada).`
                        : `Error de WF sin workflow asociado para BP: ${bp.provider_name || bp_id}: ${comments || 'Sin comentarios'}. WF Instance: ${workflow_instance_id || 'N/A'}. El alta ya estaba finalizada y no hay modificación activa: no se modificó ningún dato.`).slice(0, 500),
                    ticket_display: bp.business_partner_number,
                    business_partner_ID: bp_id,
                    result: 'ERROR'
                });

                return { bp_id, s4_business_partner: bp.business_partner_number, status: 'ERROR_WF' };
            }

            if (isModif) {
                // MODIFICACIÓN (STAGING / apply-on-success): el WF terminó de impactar S/4.
                // Recién ahora, y SÓLO si fue ÉXITO, se aplica el borrador PENDIENTE del proveedor
                // al BP local y se elimina. Si fue ERROR, el borrador queda PENDIENTE para reintento
                // y el BP NO se toca (no queda inconsistente con S/4). No se toca el business_partner_number
                // (el BP ya existe) ni el WorkflowStatus del alta (ABM): se cierra el WF de la modificación.
                if (!isError) {
                    const pending = await SELECT.one.from('suppliersInitiative.BusinessPartnerModifications')
                        .where({ businessPartner_ID: bp_id, area: modifAreaCode, status: 'PENDIENTE' });
                    if (pending?.payload) {
                        await applyModificationPayload(bp_id, pending.payload);
                        await DELETE.from('suppliersInitiative.BusinessPartnerModifications').where({ ID: pending.ID });
                    }
                }

                await UPDATE('suppliersInitiative.WorkflowStatus')
                    .set({
                        status: isError ? 'ERROR_WF' : 'FINALIZADO',
                        description: isError
                            ? `Error aplicando la modificación de ${modifAreaLabel} en S/4: ${comments || 'Sin comentarios'}`
                            : `Modificación de ${modifAreaLabel} aplicada en S/4`
                    })
                    .where({ business_partner_ID: bp_id, application_type: modifWf.application_type });
            } else {
                // ALTA: se persiste el número S/4 devuelto y se cierra el WF ABM.
                if (!isError && s4_business_partner) {
                    await UPDATE('suppliersInitiative.BusinessPartners')
                        .set({ business_partner_number: s4_business_partner })
                        .where({ ID: bp_id });

                    // IAS: customAttribute1 = bp_number + ProveedorProvisorio → ProveedorActivo.
                    // Este es el callback real de fin de WF (BPA), a diferencia de
                    // confirmS4Creation (abmcontratista.js) que es de uso manual/legacy.
                    const contact = await SELECT.one.from('suppliersInitiative.Contacts')
                        .columns('contact_email')
                        .where({ business_partner_ID: bp_id });
                    const providerEmail = (contact?.contact_email || '').toLowerCase();

                    if (providerEmail) {
                        try {
                            const { promoteToActiveProvider } = require('./utils/ias-provider-lifecycle');
                            const r = await promoteToActiveProvider({ email: providerEmail, bpNumber: s4_business_partner });
                            await INSERT.into(ApplicationLogs).entries({
                                app: 'ABM Contratistas',
                                modification: 'IAS_PROVIDER_ACTIVATED',
                                description: `"${providerEmail}" → ProveedorActivo, customAttribute1=${s4_business_partner}. ${r.message}`,
                                ticket_display: s4_business_partner,
                                business_partner_ID: bp_id,
                                result: r.success ? 'SUCCESS' : 'WARNING'
                            });
                        } catch (err) {
                            console.error('[IAS] Error promoviendo a ProveedorActivo:', err.message);
                        }
                    }
                }

                await UPDATE('suppliersInitiative.WorkflowStatus')
                    .set({
                        status: isError ? 'ERROR_WF' : 'FINALIZADO',
                        description: isError
                            ? `Error en workflow S4: ${comments || 'Sin comentarios'}`
                            : `BP creado en S4: ${s4_business_partner || 'N/A'}. ${comments || ''}`
                    })
                    .where({ business_partner_ID: bp_id, application_type: 'ABM' });
            }

            await INSERT.into(ApplicationLogs).entries({
                app: 'ABM Contratistas',
                modification: isModif
                    ? (isError ? `${modifAreaCode}_MODIF_ERROR` : `${modifAreaCode}_MODIF_FINALIZED`)
                    : (isError ? 'WF_ERROR' : 'S4_CREATED'),
                description: isModif
                    ? (isError
                        ? `Error aplicando la modificación de ${modifAreaLabel} en S4 para BP: ${bp.provider_name || bp_id}: ${comments || 'Sin comentarios'}`
                        : `Modificación de ${modifAreaLabel} aplicada en S4 para BP: ${bp.provider_name || bp_id}. WF Instance: ${workflow_instance_id || 'N/A'}. ${comments || ''}`)
                    : (isError
                        ? `Error en workflow S4: ${comments || 'Sin comentarios'}`
                        : `BP creado en S4. BusinessPartner: ${s4_business_partner}. WF Instance: ${workflow_instance_id || 'N/A'}. ${comments || ''}`),
                ticket_display: s4_business_partner || bp.business_partner_number || bp_id,
                business_partner_ID: bp_id,
                result: isError ? 'ERROR' : 'SUCCESS'
            });

            return {
                bp_id,
                s4_business_partner: s4_business_partner || null,
                status: isError ? 'ERROR_WF' : 'FINALIZADO'
            };

        } catch (err) {
            if (err.code) throw err;
            console.error(`[endWorkflowABM] Error inesperado:`, err.message, err.stack);
            return req.reject(500, `Error interno en endWorkflowABM: ${err.message}`);
        }
    });

    // ─── approveWorkflow ──────────────────────────────────────────────────
    // Sin cambios
    // ─────────────────────────────────────────────────────────────────────
    this.on('approveWorkflow', async (req) => {
        const { bpId, status } = req.data;
        const { BusinessPartners, ApplicationLogs } = cds.entities;

        const bp = await SELECT.one.from(BusinessPartners).where({ ID: bpId });
        if (!bp) return req.reject(404, 'Business Partner not found');

        await INSERT.into(ApplicationLogs).entries({
            app: 'ABM Contratistas',
            modification: 'WF_APPROVED',
            description: `Workflow APPROVED by ${req.user.id}. Comments: ${comments || 'No comments'}`,
            ticket_display: bp.business_partner_number || 'N/A',
            result: `${status == "200" ? 'SUCCES' : 'ERROR'}`
        });

        return { message: "Business Partner approved successfully" };
    });

    // ─── endWorkflowBlock ─────────────────────────────────────────────────
    this.on('endWorkflowBlock', async (req) => {
        try {
            const { business_partner_number, status, comments, workflow_instance_id } = req.data;

            if (!business_partner_number) return req.reject(400, 'business_partner_number es obligatorio');

            const { ApplicationLogs } = cds.entities;

            const bp = await SELECT.one.from('suppliersInitiative.BusinessPartners')
                .where({ business_partner_number });
            if (!bp) {
                console.warn(`[endWorkflowBlock] ⚠ BP ${business_partner_number} no encontrado → rechazando`);
                return req.reject(404, `Business Partner ${business_partner_number} no encontrado`);
            }

            const bp_id = bp.ID;
            const isError = status === 'ERROR_WF';

            // Inferir bloqueo/desbloqueo desde el WorkflowStatus pendiente
            const pendingWf = await SELECT.one.from('suppliersInitiative.WorkflowStatus')
                .where({ business_partner_ID: bp_id, application_type: 'BLOCK' })
                .orderBy('createdAt desc');

            const block = pendingWf
                ? !String(pendingWf.description || '').includes('DESBLOQUEO')
                : true;

            const action = block ? 'BLOQUEO' : 'DESBLOQUEO';
            const newBlockValue = isError ? bp.central_block : block;

            if (!isError) {
                await UPDATE('suppliersInitiative.BusinessPartners')
                    .set({ central_block: block })
                    .where({ ID: bp_id });
            }

            await UPDATE('suppliersInitiative.WorkflowStatus')
                .set({
                    status: isError ? 'ERROR_WF' : 'FINALIZADO',
                    description: isError
                        ? `Error en workflow Central Block (${action}): ${comments || 'Sin comentarios'}`
                        : `Central Block — ${action} aplicado. ${comments || ''}`
                })
                .where({ business_partner_ID: bp_id, application_type: 'BLOCK' });

            await INSERT.into(ApplicationLogs).entries({
                app: 'ABM Contratistas',
                modification: isError ? 'BLOCK_ERROR' : (block ? 'BLOCK_APPLIED' : 'UNBLOCK_APPLIED'),
                description: isError
                    ? `Error en workflow Central Block (${action}): ${comments || 'Sin comentarios'}`
                    : `Central Block — ${action} aplicado para BP: ${bp.provider_name || bp_id}. WF Instance: ${workflow_instance_id || 'N/A'}. ${comments || ''}`,
                ticket_display: business_partner_number,
                business_partner_ID: bp_id,
                result: isError ? 'ERROR' : 'SUCCESS'
            });

            return {
                bp_id,
                central_block: newBlockValue,
                status: isError ? 'ERROR_WF' : 'FINALIZADO'
            };

        } catch (err) {
            if (err.code) throw err;
            console.error(`[endWorkflowBlock] Error inesperado:`, err.message, err.stack);
            return req.reject(500, `Error interno en endWorkflowBlock: ${err.message}`);
        }
    });

});