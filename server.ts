const express = require("express")

import {readFileSync} from "fs";
import * as path from "path";

import {useAlipay} from "./lib/use-alipay";

const app = express();

app.listen(8080);

const alipayDir = "/Users/jhuai/OneDrive/Projects/xsfqfushi/alipay/2021003118632199";

useAlipay({
    appId: process.env.ALIPAY_APP_ID || "app_id",
    signType: "RSA2",
    appPrivateKey: readFileSync(path.join(alipayDir, "private_key.pem")),

    appPublicKey: readFileSync(path.join(alipayDir, "appCertPublicKey.crt")),
    alipayPublicKey: readFileSync(path.join(alipayDir, "alipayCertPublicKey_RSA2.crt")),
    alipayRootPublicKey: readFileSync(path.join(alipayDir, "alipayRootCert.crt")),

    encryptKey: readFileSync(path.join(alipayDir, "AES.txt")).toString(),
}, app)


console.log("have fun using alipay!");
