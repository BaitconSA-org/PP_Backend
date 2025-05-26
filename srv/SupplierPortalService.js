const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const s4 = await cds.connect.to('POService');

  this.on('READ', 'POOrders', req => {
    return s4.run(SELECT.from('POProxyOrders'));
  });
});
