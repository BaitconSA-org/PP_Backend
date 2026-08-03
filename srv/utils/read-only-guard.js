// Gate genérico de "solo lectura" para roles WZ_Visualizador / WZ_Auditor.
// Bloquea por default (fail-closed) todo evento que no sea READ; sólo deja pasar
// los eventos explícitamente listados en allowList (functions/actions de lectura).
// No afecta a ningún otro rol: solo actúa si el usuario tiene el scope Visualizador
// o Auditor (xs-security.json), sin importar qué otros roles tenga además.
function attachReadOnlyGuard(srv, allowList = []) {
    const allowed = new Set(['READ', ...allowList]);

    srv.before('*', (req) => {
       
        // Las llamadas internas del sistema corren como cds.User.Privileged, cuyo
        // is() devuelve true para CUALQUIER rol (incluidos Visualizador/Auditor), así
        // que sin esto se auto-bloquearían. Un privileged no es un usuario de solo
        // lectura: es el sistema actuando internamente → debe saltear el gate.
        if (req.user?._is_privileged) return;

        const isReadOnlyRole = req.user?.is('Visualizador') || req.user?.is('Auditor');
        if (!isReadOnlyRole || allowed.has(req.event)) return;

        return req.reject(403, `Rol de solo lectura: no autorizado para "${req.event}".`);
    });
}

module.exports = { attachReadOnlyGuard };
