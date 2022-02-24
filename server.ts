const express = require("express");
const cors = require("cors");

import {readFileSync} from "fs";
import * as path from "path";

import {useAlipay} from "./lib/use-alipay";

const app = express();

app.use(cors());

app.use(express.raw({
    limit: "1mb",
}));

app.use(express.json({
    limit: "1mb",
}));

app.listen(8080);

const alipayDir = "/Users/jhuai/OneDrive/Projects/xsfqfushi/alipay/2021003118632199";

const alipay = useAlipay({
    appId: process.env.ALIPAY_APP_ID || "app_id",
    signType: "RSA2",
    appPrivateKey: readFileSync(path.join(alipayDir, "private_key.pem")),

    appPublicKey: readFileSync(path.join(alipayDir, "appCertPublicKey.crt")),
    alipayPublicKey: readFileSync(path.join(alipayDir, "alipayCertPublicKey_RSA2.crt")),
    alipayRootPublicKey: readFileSync(path.join(alipayDir, "alipayRootCert.crt")),

    encryptKey: readFileSync(path.join(alipayDir, "AES.txt")).toString(),
    requestOptionsMap: {
        "xxx": {
            encrypt: true,
            notify: true,
            async onNotify(content, alipay) {

            },
        },
    },
}, {
    expressApp: app,
});

console.log("Have fun with Alipay!");
