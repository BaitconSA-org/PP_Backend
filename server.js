const cds = require('@sap/cds');
const express = require('express');
const bodyParser = require('body-parser');
const cdsSwagger = require('cds-swagger-ui-express');
const multer = require('multer');
const path = require('path');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Solo se permiten archivos PDF.'));
    }
    cb(null, true);
  }
});

cds.on('bootstrap', app => {
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  app.use(cdsSwagger({
    basePath: '/$api-docs',
    diagram: true
  }));

  // Logo público para embeber en mails vía <img src> (Outlook no renderiza base64 inline).
  app.get('/srv/assets/vista-logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'srv', 'utils', 'vista-logo.png'));
  });

  app.post(
    '/srv/dmsAbmcontratistas/upload',
    express.json({ limit: '50mb' }),
    async (req, res) => {
      try {
        const sToken = req.headers['x-upload-token'];
        const oTokenData = global._bpUploadTokens?.get(sToken);

        if (!oTokenData) {
          return res.status(403).json({ error: 'Token inválido.' });
        }
        if (oTokenData.expires < Date.now()) {
          global._bpUploadTokens.delete(sToken);
          return res.status(403).json({ error: 'Token expirado.' });
        }
        global._bpUploadTokens.delete(sToken);

        const { file_name, file_content, document_type, description } = req.body || {};
        if (!file_name) return res.status(400).json({ error: 'file_name es obligatorio.' });
        if (!file_content) return res.status(400).json({ error: 'file_content es obligatorio.' });

        const oSrv = await cds.connect.to('ABMContratistaService');

        const oResult = await cds.tx(
          { user: new cds.User.Privileged() },
          async () => oSrv.send('uploadDMScontratistas', {
            bp_id: oTokenData.bp_id,
            file_name,
            file_content,
            document_type: document_type ?? '',
            description: description ?? ''
          })
        );

        return res.status(200).json(oResult);

      } catch (e) {
        console.error('[dmsAbmcontratistas/upload] ERROR:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).json({ error: e?.message || e?.toString() || 'Error desconocido' });
      }
    }
  );

  app.post(
    '/srv/upload-ticket-document',
    upload.single('file'),
    async (req, res) => {
      try {
        const sToken = req.headers['x-upload-token'];
        const oTokenData = global._uploadTokens?.get(sToken);

        if (!oTokenData) {
          return res.status(403).json({ error: 'Token inválido.' });
        }
        if (oTokenData.expires < Date.now()) {
          global._uploadTokens.delete(sToken);
          return res.status(403).json({ error: 'Token expirado.' });
        }
        global._uploadTokens.delete(sToken);

        if (!req.file) return res.status(400).json({ error: 'Archivo obligatorio.' });

        const oSrv = await cds.connect.to('HESManagementService');

        const oResult = await cds.tx(
          { user: new cds.User.Privileged() },
          async () => oSrv.send('_uploadFileToDMS', {
            ticket_id: oTokenData.ticket_id,
            file_name: req.file.originalname,
            file_b64: req.file.buffer.toString('base64'),
            user_id: oTokenData.user_id ?? 'system'
          })
        );

        return res.status(200).json(oResult);

      } catch (e) {
        console.error('[upload-ticket-document] ERROR completo:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return res.status(500).json({ error: e?.message || e?.toString() || 'Error desconocido' });
      }
    }
  );
});

module.exports = cds.server;
