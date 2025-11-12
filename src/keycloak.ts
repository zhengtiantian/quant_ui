import Keycloak, {type KeycloakConfig } from "keycloak-js";

const keycloakConfig: KeycloakConfig = {
    url: "http://localhost:8080/",
    realm: "quant",
    clientId: "quant-ui"
};

const keycloak = new Keycloak(keycloakConfig);
export default keycloak;