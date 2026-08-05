service DMSService @(path: '/srv/dms') {
    action   createFolderService(folderName: String, relativePath: String)                             returns String;
    action   uploadDocumentService(folderName: String, name: String, file: LargeBinary)                returns String;
    action   deleteDocumentService(documentId: String, folderName: String);
    action   deleteFolderService(folderId: String);
    action   createDocumentService(businessPartnerId: String, documentName: String, file: LargeBinary) returns String;
    function getDocumentService(folderName: String, documentName: String)                              returns LargeBinary;
    function getFoldersService(relativePath: String)                                                   returns String;
}
