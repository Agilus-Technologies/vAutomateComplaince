import https from "https";
import iconv from "iconv-lite";
// import iconv from "iconv-lite";
import { decript, encryptAES } from "./helper.js";
import dbo from "../db/conn.js";
import axios from "axios";
import logger from '../../logger.js';
import { log } from "console";
import e from "express";

export const db_config = async (req, res) => {
    try {
        let db_connect = dbo && dbo.getDb();
        let config = await db_connect.collection("vautomate_config").find({}).toArray();
        return config
    } catch (err) {
        console.log("Error in db_config ", err)

    }

};

// export const getDnacToken = async (dnacCredentialsData) => {
//     try {
//         let hostName = dnacCredentialsData?.ip?.split("/");
//         let aesEnabled = dnacCredentialsData?.aesAuthEnabled;
//         const secretKey = dnacCredentialsData?.apiEncriptionKey
//         let options;
//         if (aesEnabled) {
//             const username = dnacCredentialsData.username;
//             const password = dnacCredentialsData.password;
//             const auth = `${username}:${password}`;
//             const cipherBase64 = encryptAES(auth, secretKey);
//             options = {
//                 // hostname: hostName /* '10.122.1.25' */,
//                 hostname: hostName[2].toString() /* '10.122.1.25' */,
//                 path: dnacCredentialsData.authUrl,
//                 method: "POST",
//                 headers: {
//                     Authorization: `CSCO-AES-256 credentials=${cipherBase64}`,
//                 },
//                 rejectUnauthorized: false
//             };
//         } else {
//             options = {
//                 // hostname: hostName[1] /* '10.122.1.25' */,
//                 hostname: hostName[2].toString() /* '10.122.1.25' */,
//                 path: dnacCredentialsData.authUrl,
//                 method: "POST",
//                 rejectUnauthorized: false,
//                 headers: {
//                     Authorization: "Basic " + Buffer.from(dnacCredentialsData.username + ":" + dnacCredentialsData.password).toString("base64"),
//                 },
//             };
//         };
//         let result = await new Promise((resolve) => {
//             var req = https.request(options, function (res) {
//                 // console.log("res",res)
//                 var data = [];
//                 res
//                     .on("data", function (chunk) {
//                         data.push(chunk);
//                     })
//                     .on("end", function () {
//                         var buffer = Buffer.concat(data);
//                         var str = iconv.decode(buffer, "windows-1252");
//                         resolve(JSON.parse(str));
//                     });
//             });
//             req.end();
//             req.on("error", function (error) {
//                 if (error) {
//                     return {
//                         result: {

//                             error: "ip is not valid.",
//                             status: false,
//                             tool: "DNA-C"
//                         },
//                     };
//                 }
//                 console.error("getting error is ", e);
//             });
//         });
//         console.log("tokenasdfghj",result)
//         return result;
//     } catch (err) {
//         console.log("Error in getDnacToken in dnacHelper", err)
//         let msg = `Error in getDnacToken in dnacHelper:${err}`
//         let msg_output = { "msg": msg, status: false }
//         return msg_output;
//     }
// };



export const getDnacToken = async (dnacCredentialsData) => {
    try {
        const hostParts = dnacCredentialsData && dnacCredentialsData?.ip?.split("/");
        const hostName = hostParts && hostParts?.[2]; // Safely extract the IP or domain
        const aesEnabled = dnacCredentialsData && dnacCredentialsData?.aesAuthEnabled;
        const secretKey = dnacCredentialsData && dnacCredentialsData?.apiEncriptionKey;

        let url = `https://${hostName}${dnacCredentialsData.authUrl}`;

        let headers = {};
        if (aesEnabled) {
            const username = dnacCredentialsData && dnacCredentialsData.username;
            const password = dnacCredentialsData && dnacCredentialsData.password;
            const auth = `${username}:${password}`;
            const cipherBase64 = encryptAES(auth, secretKey);

            headers = {
                Authorization: `CSCO-AES-256 credentials=${cipherBase64}`
            };
        } else {
            const base64Auth = Buffer.from(`${dnacCredentialsData.username}:${dnacCredentialsData.password}`).toString("base64");
            headers = {
                Authorization: `Basic ${base64Auth}`
            };
        }

        const agent = new https.Agent({ rejectUnauthorized: false });

        const response = await axios.post(url, null, {
            headers,
            httpsAgent: agent,
            responseType: 'arraybuffer' // Required if you're decoding it as 'windows-1252'
        });
        const decodedResponse = iconv.decode(Buffer.from(response.data), "windows-1252");
        const jsonResult = JSON.parse(decodedResponse);
        return jsonResult;

    } catch (err) {
        console.error("Error in getDnacToken in dnacHelper", err);
        logger.error("Error in getDnacToken in dnacHelper", err)
        return {
            msg: `Error in getDnacToken in dnacHelper: ${err.message || err}`,
            status: false
        };
    }
};
async function getInstanceUuid(dnacUrl, ipAddress, token) {
    try {
        const url = `${dnacUrl}/dna/intent/api/v1/network-device/ip-address/${ipAddress}`;
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false // Accept self-signed certificate
        });

        const response = await axios.get(url, {
            headers: {
                'X-Auth-Token': token
            },
            httpsAgent
        });

        const instanceUuid = response.  data.response.instanceUuid;
        return instanceUuid;
    } catch (error) {
        logger?.error?.("error in getInstanceUuid", error); // Optional chaining for safety
        console.error('Error getting instanceUuid:', error.message);
        throw new Error('Unable to fetch instanceUuid');
    }
}

export const commonCredentials = async (ip = "", dnacUrl = "") => {
    try {
        let db_connect = dbo && dbo.getDb()
        // let config = await db_config();
        let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "dnac": 1, "_id": 0 }).toArray();
        let switchUUID = "";
        if (ip !== "") {
            let deviceUUId = await db_connect.collection('ms_device').find({ $and: [{ source: "DNAC" }, { managementIpAddress: ip }, { "source_url": dnacUrl }] }).toArray();
            switchUUID = deviceUUId && deviceUUId[0]?.device_id
        }
        let AUTH_API_URL = "/dna/system/api/v1/auth/token"
        // let template_id = "48967f32-a1de-46a0-a407-84164b8"
        let dnacDetailss = setUpDetails[0]?.dnac.filter((item) => item?.DnacURL === dnacUrl)
        let cli_command_url = `${dnacDetailss[0]?.DnacURL}/api/v1/network-device-poller/cli/read-request`;
        let deploy_temp_url = `${dnacDetailss[0]?.DnacURL}/dna/intent/api/v1/template-programmer/template/deploy`;
        let temp_deploy_status_url = `${dnacDetailss[0]?.DnacURL}/dna/intent/api/v1/template-programmer/template/deploy/status/`;
        let interfaceAPi = `${dnacDetailss[0]?.DnacURL}/dna/intent/api/v1/interface/network-device/`;

        let dnacCredentials = {
            authUrl: AUTH_API_URL,
            ip: dnacDetailss[0]?.DnacURL,
            username: dnacDetailss[0]?.DnacUserName,
            password: decript(dnacDetailss[0]?.DnacPassWord),
            aesAuthEnabled: dnacDetailss[0]?.is_aes_auth || false,
            apiEncriptionKey: dnacDetailss[0]?.secret_key || ""
        }
        let token = await getDnacToken(dnacCredentials);
        if (!switchUUID && ip && dnacUrl) {
            try {
                switchUUID = await getInstanceUuid(dnacUrl, ip, token.Token);
            } catch (apiErr) {
                console.log("Failed to fetch instanceUuid from DNAC API:", apiErr.message);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (Object.keys(token).length == 0 || token?.Token == "") {
            let msg = `Unable to get token from dnac in credentials`
            let msg_output = { "msg": msg, status: false }
            return msg_output
        }
        token = token && token?.Token
        let obj = {
            token: token,
            dnacCredentials,
            cli_command_url,
            deploy_temp_url,
            temp_deploy_status_url,
            AUTH_API_URL,
            switchUUID,
            interfaceAPi,
            dnacUrl: dnacDetailss[0]?.dnacUrl || dnacUrl,
            // template_id
        }
        return obj;
    } catch (err) {
        logger.error("error in commanCredentials",err)
        console.log("Error in commanCredentials in dnacHelper", err)
        let msg = `Error in commanCredentials in dnacHelper:${err}`
        let msg_output = { "msg": msg, status: false }
        return msg_output;
    }
};

export const fileIDResponse = async (dnacUrl, device, taskOutput) => {
    try {
        let { token } = await commonCredentials(device, dnacUrl)
        if (token == "") {
            let msg = `Unable to get token from dnac in fileIDResponse`
            let msg_output = { "msg": msg, status: false }
            return msg_output
        }
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `${dnacUrl}/api/v1/file/${taskOutput}`,
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            },
            httpsAgent: httpsAgent
        };
        const response = await axios.request(config);
        if (Object.keys(response).length == 0 || response.data.length == 0 || Object.keys(response.data[0].commandResponses).length == 0 || Object.keys(response.data[0].commandResponses.SUCCESS).length == 0) {
            return { data: "", msg: "Unable to get file id", status: false }
        }
        let output = response.data[0].commandResponses.SUCCESS
        let result = ""
        for (let item in output) {
            result = output[item]
        }
        return { data: result, msg: "data get successfully", status: true }
    } catch (err) {
        logger.error("error in fileIDResponse",err)
        console.log("error in fileIDResponse", err)
        return { data: "", msg: `Error msg in fileIDResponse:${err.message || err}`, status: false }
    }
};

export const taskResponse = async (dnacUrl, device, taskUrl) => {
    try {
        let { token } = await commonCredentials(device, dnacUrl)
        if (token == "") {
            let msg = `Unable to get token from dnac in taskResponse`
            let msg_output = { "msg": msg, status: false }
            return msg_output
        }
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `${dnacUrl}/dna/intent${taskUrl}`,
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            },
            httpsAgent: httpsAgent
        };
        await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await axios.request(config);
        if (Object.keys(response).length == 0 || Object.keys(response.data).length == 0 || Object.keys(response.data.response).length == 0 || response.data.response.progress == "" || response.data.response.progress == 'CLI Runner request creation') {
            return { fileId: "", msg: "Unable to get file id", status: false }
        }
        let { fileId } = JSON.parse(response.data.response.progress)
        return { fileId, msg: "file id get successfully", status: true }
    } catch (err) {
        logger.error("error in taskResponse",err)
        let msgOutput = { fileId: "", msg: `Error in taskResponse:${err.message || err}`, status: false }
        console.log("error in taskurl", err)
        return msgOutput
    }

}

export const dnacResponse = async (dnacUrl, device, ip) => {
    try {
        let { token, switchUUID } = await commonCredentials(device, dnacUrl)
        if (token == "") {
            let msg = `Unable to get token from dnac in dnacResponse`
            let msg_output = { "msg": msg, status: false }
            return msg_output
        }
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let body = {
            "commands": [`ping ${ip}`],
            "deviceUuids": [switchUUID]
        }
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${dnacUrl}/dna/intent/api/v1/network-device-poller/cli/read-request`,
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            },
            data: body,
            httpsAgent: httpsAgent
        };


// Retry axios request up to 5 times
        let response = null;
        for (let i = 0; i < 5; i++) {
            try {
                response = await axios.request(config);
                if (
                    response && 
                    response.data && 
                    response.data.response && 
                    response.data.response.url
                ) {
                    break; // successful response
                }
            } catch (err) {
                // Optional: Log internal retry error here
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2s before retry
        }

        if (
            !response || 
            !response.data || 
            !response.data.response || 
            !response.data.response.url
        ) {
            logger.error("Failed to send ping",response)
            return { msg: "Failed to send ping request. Please try again shortly.", status: false };
        }

        let taskUrl = response.data.response.url
        // let taskOutput = await taskResponse(dnacUrl, device, taskUrl)

          // Poll for task completion
        let taskOutput = null;
        for (let i = 0; i < 10; i++) {
            taskOutput = await taskResponse(dnacUrl, device, taskUrl);
            if (taskOutput && taskOutput.status && taskOutput.fileId) break;
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        if (!taskOutput || !taskOutput.status || !taskOutput.fileId) {
             logger.error("Error in taskOutput", taskOutput)
            return { msg: "Ping request is taking too long. Please try again", status: false };
        }
        // if (Object.keys(taskOutput) == 0 || Object.keys(taskOutput).length == 0 || taskOutput.status == false) {
        //     // logger.error(taskOutput)
        //     return taskOutput
        // }
         let fileOutput = null;
        for (let i = 0; i < 10; i++) {
            fileOutput = await fileIDResponse(dnacUrl, device, taskOutput.fileId);
            if (fileOutput && fileOutput.status) break;
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        if (!fileOutput || !fileOutput.status) {
            logger.error("Error in fileOutput", fileOutput)
            return { msg: "Ping result is not available yet. Please wait a few moments and retry", status: false };
        }
        return fileOutput
    } catch (err) {
        logger.error("Failed to send ping",err)
        let msgOutput = { data: "", msg: `Ping request failed:${err.message || err}`,status:false }
        return msgOutput
    }
}

export const execute_templates = async (item) => {
    try {
        let db_connect = dbo && dbo.getDb()
        let getTemplateId = await db_connect.collection('ms_dnac_template_id').findOne({"dnac_url": item.dnac,software_type:"IOS-XE"});
        let template_id = getTemplateId?.template_id;
        let credData = await commonCredentials(item.device, item.dnac);
        const { token, deploy_temp_url, temp_deploy_status_url, switchUUID, dnacCredentials } = credData;
        if (token == "") {
            let msg = `Unable to get token from dnac in excute_templates`
            let msg_output = { "msg": msg, status: false }
            return msg_output
        }
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        let data = {
            "templateId": template_id,
            "targetInfo": [
                {
                    "id": item.device,
                    "type": "MANAGED_DEVICE_IP",
                    "params": {
                        "param": item.config
                    }
                }
            ]
        };

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${item.dnac}/dna/intent/api/v1/template-programmer/template/deploy`,
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            },
            data: data,
            httpsAgent: httpsAgent
        };

        // Log the request data to verify
        console.log("Request Payload:", JSON.stringify(data, null, 2));

        // Send the POST request
        const response = await axios.request(config);
        // console.log("Response Status:", response.status);
        // console.log("Response Data:", JSON.stringify(response.data, null, 2));
                console.log("✅ Deployment response:", JSON.stringify(response.data, null, 2));
        let deploymentIdsss = JSON.stringify(response.data, null, 2)
        deploymentIdsss = JSON.parse(deploymentIdsss)
        const deployment_ids = deploymentIdsss.deploymentId.split(":").pop().trim()
        if (deployment_ids == "None of the targets are applicable for the template. Hence not deploying") {
            console.log("None of the targets are applicable for the template. Hence not deploying")
            return { msg: "None of the targets are applicable for the template. Hence not deploying", status: false }
        } else {
            let temp_deploy_status_urls = temp_deploy_status_url + deployment_ids
            await new Promise(resolve => setTimeout(resolve, 10000));
            let secondConfig = {
                method: 'get',
                maxBodyLength: Infinity,
                url: temp_deploy_status_urls,
                headers: {
                    'x-auth-token': token,
                    'Content-Type': 'application/json'
                },
                httpsAgent: httpsAgent
            };
            let deployStatus = ""
            let excuteRes = false
            setTimeout(() => {
                excuteRes = true;
            }, 40000);
            while ((deployStatus !== "SUCCESS" || deployStatus !== "FAILURE") && excuteRes === false) {
                // let headers = { "x-auth-token": token };
                const responses = await axios.request(secondConfig);
                console.log("📡 Full status response:", JSON.stringify(responses.data, null, 2));
                deployStatus = responses?.data?.devices?.[0]?.status;
                // deployStatus = responses.data.devices[0].status
                if (deployStatus === "SUCCESS" || deployStatus === "FAILURE") {
                    excuteRes = true
                }
            }
            // await new Promise(resolve => setTimeout(resolve, 5000));
            return deployStatus
        }

        if (response.status !== 200) {
            console.log("Error: Request failed with status", response.status);
            return { msg: `Request failed with status ${response.status}`, status: false };
        }
        const deployment_id = response.data.deploymentId;
        return deployment_id;

    } catch (error) {
        logger.error("Request failed with status",error)

        console.log("Error: Request failed with status", error?.message || error);
        return { msg: `Error in excute_template ${error.message}`, status: false };
    }
};



export const run_show_command_on_device = async (dnac_url, device_ip, command) => {
    try {
        let db_connect = dbo && dbo.getDb();
        const credData = await commonCredentials(device_ip, dnac_url);
        const { token, dnacCredentials } = credData;

        if (!token) {
            logger.error("Unable to get DNAC token in run_show_command_on_device");
            return { msg: "Unable to get DNAC token", status: false };
        }

        const httpsAgent = new https.Agent({ rejectUnauthorized: false });

        // Step 1: Get device UUID by IP
        const deviceResp = await axios.get(`${dnac_url}/dna/intent/api/v1/network-device?managementIpAddress=${device_ip}`, {
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            },
            httpsAgent
        });

        const device = deviceResp.data.response?.[0];
        if (!device) {
            return { msg: "Device not found with given IP", status: false };
        }

        const deviceUUID = device.id;

        // Step 2: Send Command Runner request
        const commandReq = await axios.post(`${dnac_url}/dna/intent/api/v1/network-device-poller/cli/read-request`, {
            commands: [command],
            deviceUuids: [deviceUUID]
        }, {
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            },
            httpsAgent
        });

        const taskId = commandReq.data.response.taskId;
        console.log("📨 Command Task ID:", taskId);

        // Step 3: Poll Task Status
        let fileId = null;
        let timeoutCounter = 0;

        while (!fileId && timeoutCounter < 10) {
            await new Promise(res => setTimeout(res, 4000));
            const taskResp = await axios.get(`${dnac_url}/dna/intent/api/v1/task/${taskId}`, {
                headers: {
                    'x-auth-token': token
                },
                httpsAgent
            });

            const progress = taskResp.data.response?.progress;
            if (progress && progress.includes("fileId")) {
                const progressJson = JSON.parse(progress);
                fileId = progressJson.fileId;
                break;
            }

            timeoutCounter++;
        }

        if (!fileId) {
            logger.error("Timeout: fileId not received in run_show_command_on_device");

            return { msg: "Timeout: fileId not received", status: false };
        }

        // Step 4: Get command output by fileId
        const fileResp = await axios.get(`${dnac_url}/dna/intent/api/v1/file/${fileId}`, {
            headers: {
                'x-auth-token': token
            },
            httpsAgent
        });

        const rawOutput = fileResp.data?.[0]?.commandResponses?.SUCCESS?.[command];
        if (!rawOutput) return { msg: "Command output missing", status: false };

        return { status: true, output: rawOutput };

    } catch (error) {
        console.error("Error running command:", error.message || error);
        return { msg: `Error: ${error.message}`, status: false };
    }
};



