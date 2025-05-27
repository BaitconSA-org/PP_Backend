const cds = require('@sap/cds');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');


module.exports = cds.service.impl (async function() {

  const s4hanaPO = await cds.connect.to('purchaseorder_edmx');

  this.on('READ', 'PurchaseOrderExt', (req) => {
    console.log('>> delegating to remote service...');
    return s4hanaPO.run(req.query);
  });    


});