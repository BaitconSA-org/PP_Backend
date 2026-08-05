service IASUserService @(path: '/srv/IAS') {

    action getProviderUsers()                                  returns array of {
        id            : String; // SCIM id del usuario en IAS
        email         : String;
        firstName     : String;
        lastName      : String;
        displayName   : String;
        status        : String; // 'active' | 'inactive' | 'invited'
        groups        : array of String;
        lastInvitedAt : String; // ISO timestamp o null
    };

    action checkBPDuplicate(razonSocial: String,
                            cuit: String,
                            email: String)                     returns {
        alreadyDone : Boolean;
        source      : String; // 'LOCAL' | 'S4' | 'NONE'
        bp_id       : String;
        bp_name     : String;
        matchedBy   : String; // 'CUIT' | 'DOMAIN'
    };

    action getBTPUsersByRoleCollection(roleCollection: String) returns {
        roleCollection : String;
        count          : Integer;
        users          : array of {
            id        : String;
            userName  : String;
            email     : String;
            firstName : String;
            lastName  : String;
            origin    : String;
            active    : Boolean;
        };
    };

    // extender el invite con los campos del mail
    action inviteProviderUser(email: String,
                              firstName: String,
                              lastName: String,
                              razonSocial: String, // ← nuevo
                              cuit: String // ← nuevo
    )                                                          returns {
        success   : Boolean;
        iasUserId : String;
        message   : String;
    };

    // camino B
    // camino B — una fila por email invitable (contacto principal + cobranzas)
    action getServiceBPs()                                     returns array of {
        bp_id     : String;
        name      : String;
        cuit      : String;
        lifnr     : String;
        email     : String;
        sector    : String; // 'Contacto' | 'Comercial' | 'Cobranzas'
        firstName : String;
        lastName  : String;
    };

    action inviteBPUsers(invitations:many Invitation)                                                         returns {
        invited : Integer;
        updated : Integer; // ← faltaba: el handler lo devuelve pero el .cds no lo exponía
        skipped : Integer;
        details : array of {
            bp_id  : String;
            email  : String;
            result : String;
        };
    };

    type Invitation {
        bp_id : String;
        email : String;
    }

    action resendInvitation(iasUserId: String)                 returns {
        success : Boolean;
        message : String;
    };

    action createBTPShadowUser(email: String,
                               firstName: String,
                               lastName: String,
                               origin: String)                 returns {
        success : Boolean;
        userId  : String;
        message : String;
    };

    action assignBTPRoleCollection(email: String,
                                   origin: String,
                                   roleCollection: String)     returns {
        success : Boolean;
        message : String;
    };


}
