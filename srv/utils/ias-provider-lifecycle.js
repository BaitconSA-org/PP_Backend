const sapCfAxios = require('sap-cf-axios').default;

const scimHeaders = {
    'Content-Type': 'application/scim+json',
    'Accept': 'application/scim+json',
};

const iasAxios = () => sapCfAxios('CAP_IAS_SCIM');
const xsuaaApiAxios = () => sapCfAxios('CAP_XSUAA_APIACCESS');

// Mismo patrón que _inviteSingleUser (IASUserService.js) para ubicar al user por email.
async function _findIASUserIdByEmail(email) {
    const res = await iasAxios()({
        method: 'GET', url: '/scim/Users',
        params: { filter: `emails.value eq "${email}"` },
        headers: scimHeaders,
    });
    return res.data?.Resources?.[0]?.id || null;
}

// Copia de _setIASCustomAttribute (IASUserService.js): mismo namespace/patrón de PATCH.
async function _setCustomAttribute(userId, attributeValue) {
    await iasAxios()({
        method: 'PATCH',
        url: `/scim/Users/${userId}`,
        data: {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{
                op: 'add',
                path: 'urn:sap:cloud:scim:schemas:extension:custom:2.0:User:attributes',
                value: [{ name: 'customAttribute1', value: String(attributeValue) }]
            }]
        },
        headers: scimHeaders
    });
}

// Copia de _findBTPUserId (IASUserService.js): shadow user de BTP por userName+origin.
async function _findBTPUserId(userName, origin) {
    const res = await xsuaaApiAxios()({ method: 'GET', url: '/Users', params: { count: 500 } });
    const list = res.data?.resources || res.data?.Resources || [];
    const u = list.find(x =>
        (x.userName || '').toLowerCase() === userName.toLowerCase() &&
        x.origin === origin
    );
    return u?.id || null;
}

// Copia de _assignBTPRoleCollectionById (IASUserService.js).
async function _addToRoleCollection(btpId, origin, roleCollection) {
    await xsuaaApiAxios()({
        method: 'POST',
        url: `/Groups/${encodeURIComponent(roleCollection)}/members`,
        headers: { 'Content-Type': 'application/json' },
        data: { origin, type: 'USER', value: btpId }
    });
}

// NUEVO: inverso de _addToRoleCollection. Sin precedente probado en el repo — ver
// nota de riesgo en el plan (verificar contra CAP_XSUAA_APIACCESS real antes de prod).
async function _removeFromRoleCollection(btpId, origin, roleCollection) {
    await xsuaaApiAxios()({
        method: 'DELETE',
        url: `/Groups/${encodeURIComponent(roleCollection)}/members/${encodeURIComponent(btpId)}`,
        params: { origin }
    });
}

// ── Paso 1: alta local → customAttribute1 = CUIL (proveedor provisorio) ────────
async function syncProvisionalCuil({ email, cuil }) {
    if (!email || !cuil) return { success: false, message: 'email o cuil faltante.' };

    try {
        const iasUserId = await _findIASUserIdByEmail(email);
        if (!iasUserId) {
            return { success: false, message: `No se encontró usuario IAS para "${email}".` };
        }

        await _setCustomAttribute(iasUserId, cuil);
        return { success: true, message: `customAttribute1 seteado a "${cuil}" para "${email}".` };

    } catch (err) {
        const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        return { success: false, message: `Error seteando customAttribute1: ${detail}` };
    }
}

// ── Paso 2: BP creado en S/4 → customAttribute1 = bp_number + ProveedorActivo ──
async function promoteToActiveProvider({ email, bpNumber }) {
    if (!email || !bpNumber) return { success: false, warnings: [], message: 'email o bpNumber faltante.' };

    const warnings = [];
    const origin = process.env.IAS_ORIGIN_KEY;
    const rcProvisorio = process.env.BTP_RC_PROVISORIO || 'ProveedorProvisorio';
    const rcActivo = process.env.BTP_RC_ACTIVO || 'ProveedorActivo';

    try {
        const iasUserId = await _findIASUserIdByEmail(email);
        if (!iasUserId) {
            return { success: false, warnings, message: `No se encontró usuario IAS para "${email}".` };
        }

        await _setCustomAttribute(iasUserId, bpNumber);

        if (!origin) {
            warnings.push('IAS_ORIGIN_KEY no configurado — se omitió el cambio de Role Collection en BTP.');
            return { success: true, warnings, message: `customAttribute1 seteado a "${bpNumber}" para "${email}". ${warnings.join(' | ')}` };
        }

        const btpId = await _findBTPUserId(email, origin);
        if (!btpId) {
            warnings.push(`No se encontró shadow user de BTP para "${email}" (origin ${origin}).`);
            return { success: true, warnings, message: `customAttribute1 seteado a "${bpNumber}" para "${email}". ${warnings.join(' | ')}` };
        }

        try {
            await _removeFromRoleCollection(btpId, origin, rcProvisorio);
        } catch (rcErr) {
            const d = rcErr.response?.data ? JSON.stringify(rcErr.response.data) : rcErr.message;
            warnings.push(`No se pudo quitar de "${rcProvisorio}": ${d}`);
        }

        try {
            await _addToRoleCollection(btpId, origin, rcActivo);
        } catch (rcErr) {
            const d = rcErr.response?.data ? JSON.stringify(rcErr.response.data) : rcErr.message;
            warnings.push(`No se pudo agregar a "${rcActivo}": ${d}`);
        }

        const baseMsg = `customAttribute1 seteado a "${bpNumber}" para "${email}", RC ${rcProvisorio} → ${rcActivo}.`;
        return { success: true, warnings, message: warnings.length ? `${baseMsg} Advertencias: ${warnings.join(' | ')}` : baseMsg };

    } catch (err) {
        const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        return { success: false, warnings, message: `Error promoviendo a ProveedorActivo: ${detail}` };
    }
}

module.exports = { syncProvisionalCuil, promoteToActiveProvider };
