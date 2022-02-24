# use-alipay

Unofficial Alipay SDK

# Use Alipay

```typescript
import {useAlipay} from "use-alipay";
import {readFileSync} from "fs";

const alipay = useAlipay({
    appId: "your_app_id",

    appPrivateKey: readFileSync("private_key.pem"),

    // If encrypt is enabled
    encryptKey: readFileSync("AES.txt"),

    // If you are using public key certification
    appPublicKey: readFileSync(path.join(alipayDir, "appCertPublicKey.crt")),
    alipayPublicKey: readFileSync(path.join(alipayDir, "alipayCertPublicKey_RSA2.crt")),
    alipayRootPublicKey: readFileSync(path.join(alipayDir, "alipayRootCert.crt")),
});

// Perform a trade query
const queryResponse = await alipay.request({
    "out_trade_no": "xxx"
})
```

## Expose RESTful Alipay API with Expressjs

With Expressjs, you can expose RESTful Alipay service easy.

```typescript
import {useAlipay} from "./use-alipay";

const express = require("express");

const app = express();
app.use(express.json());
app.use(express.raw());
app.use(express.urlencoded());

const alipay = useAlipay({
    appId: "your_app_id",
    // more alipay configurations
}, {
    expressApp: app,
    alipayMountPoint: "/alipay",
    unsafeMountPoint: "/unsafe/alipay"
});

app.listen(8080);
```

Now you can send a request via `curl`
```shell
$ curl -v -X POST -H "Content-Type: application/json" \
'http://localhost:8080/unsafe/alipay/submit/alipay.trade.query' \
-d '{"out_trade_no": "xxx"}' 
```

### RESTful Endpoints
- POST `/unsafe/alipay/submit/:method` Submit a request
- POST `/unsafe/alipay/sign/:method` Sign a request
- POST `/alipay/ack/:method` Receives asynchronous notify from Alipay
- POST `/alipay/encrypt` Encrypt request body and response with `base64` encoded text
- POST `/alipay/decrypt` Decrypt request body

