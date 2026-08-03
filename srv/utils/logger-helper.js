const cds = require('@sap/cds');

/**
 * @param {Object} req - El objeto request original para sacar el usuario
 * @param {Object} logData - Datos base (aplicativo, accion, ticket, proveedor, estado)
 * @param {Object} oldData - El registro tal cual estaba en la DB (opcional)
 * @param {Object} newData - Los cambios que se enviaron o la rta de S/4
 */
async function writeLog(req, logData, oldData = null, newData = null) {
    const logSrv = await cds.connect.to('LogService');
    
    await logSrv.send('logEvent', {
        ...logData,
        user: req.user.id, // CAP identifica automáticamente al usuario logueado
        previous_data: oldData ? JSON.stringify(oldData) : null,
        new_data: newData ? JSON.stringify(newData) : null,
    });
}

module.exports = { writeLog };