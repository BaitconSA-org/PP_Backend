const cds = require('@sap/cds');

// Función genérica para conectarse a cualquier API de S/4HANA
async function getS4Service(serviceName) {
    try {
        return await cds.connect.to(serviceName);
    } catch (error) {
        console.error(`Error conectando al servicio S/4HANA: ${serviceName}`, error);
        throw error;
    }
}

module.exports = {
    getS4Service
};