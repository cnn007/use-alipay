"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = __importStar(require("path"));
const express = require("express");
const cors = require("cors");
const use_alipay_1 = require("./lib/use-alipay");
const app = express();
app.use(cors());
app.use(express.raw({ limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
const alipayDir = process.env.ALIPAY_CONFIG_DIR || ".";
const alipay = (0, use_alipay_1.useAlipay)({
    appId: process.env.ALIPAY_APP_ID || "your_app_id",
    signType: "RSA2",
    appPrivateKey: (0, fs_1.readFileSync)(path.join(alipayDir, "private_key.pem")),
    // If you are not using public key certification
    appPublicKey: (0, fs_1.readFileSync)(path.join(alipayDir, "appCertPublicKey.crt")),
    alipayPublicKey: (0, fs_1.readFileSync)(path.join(alipayDir, "alipayCertPublicKey_RSA2.crt")),
    alipayRootPublicKey: (0, fs_1.readFileSync)(path.join(alipayDir, "alipayRootCert.crt")),
    // If encrypt is enabled
    encryptKey: (0, fs_1.readFileSync)(path.join(alipayDir, "AES.txt")).toString(),
    // Config request here.
    // There are so many request types in alipay open API, we can not config
    // them all. So just config them if
    // 1) the request need encrypt, or
    // 2) you expect asynchronous notification from alipay
    requestOptionsMap: {
        "alipay.trade.precreate": {
            encrypt: true,
            notify: true,
            async onNotify(content, alipay) {
                // Alipay will notify again if you throw an error
                throw new Error("Notify me again");
            },
        },
    },
}, {
    expressApp: app,
});
app.listen(8080);
// Perform a trade query
// alipay.request("alipay.trade.query", {
//     out_trade_no: ""
// });
console.log("Have fun with Alipay!");
