using {suppliersInitiative.SoxUnifiedAuditLog} from '../db/vista-schema';

@path: '/audit-service'
service AuditLogService {
    @readonly
    entity RegistroAuditoria as
        projection on SoxUnifiedAuditLog {
            LogID,
            Fecha,
            Usuario,
            Accion,
            Descripcion,
            Ticket,
            Entidad, // ← nuevo
            NumeroFiscal // CUIT/NIF del BP (para buscar/filtrar)
        };

    action approveWorkflow(bpId: UUID, comments: String);
    action endWorkflowPrecert(ticket_ID: UUID, status: String, comments: String, hes_number: String, workflow_instance_id: String, location: String, POItem: String);

    action endWorkflowSolicitudSolped(ticket_ID: UUID,
                                      status: String,
                                      comments: String,
                                      workflow_instance_id: String,
                                      pr_number: String,
                                      approved_pr_items: many String);

    action endWorkflowABM(bp_id: UUID, status: String, s4_business_partner: String, comments: String, workflow_instance_id: String);
    action endWorkflowBlock(business_partner_number: String, status: String, comments: String, workflow_instance_id: String);
}
