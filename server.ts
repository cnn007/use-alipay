import {readFileSync} from "fs";
import * as path from "path";

const express = require("express");
const cors = require("cors");

import {useAlipay} from "./lib/use-alipay";

const app = express();
app.use(cors());
app.use(express.raw({limit: "1mb"}));
app.use(express.json({limit: "1mb"}));

const alipayDir = process.env.ALIPAY_CONFIG_DIR || ".";

const alipay = useAlipay({
    appId: process.env.ALIPAY_APP_ID || "your_app_id",
    signType: "RSA2",
    appPrivateKey: readFileSync(path.join(alipayDir, "private_key.pem")),

    // If you are not using public key certification
    appPublicKey: readFileSync(path.join(alipayDir, "appCertPublicKey.crt")),
    alipayPublicKey: readFileSync(path.join(alipayDir, "alipayCertPublicKey_RSA2.crt")),
    alipayRootPublicKey: readFileSync(path.join(alipayDir, "alipayRootCert.crt")),

    // If encrypt is enabled
    encryptKey: readFileSync(path.join(alipayDir, "AES.txt")).toString(),

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
