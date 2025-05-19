import https from "https";
import iconv from "iconv-lite";
// import iconv from "iconv-lite";
import { decript, encryptAES } from "./helper.js";
import dbo from "../db/conn.js";
import axios from "axios";
import logger from '../../logger.js';

export const db_config = async (req, res) => {
    try {
        let db_connect = dbo && dbo.getDb();
        let config = await db_connect.collection("vautomate_config").find({}).toArray();
        return config
    } catch (err) {
        console.log("Error in db_config ", err)

    }

};

export const getDnacToken = async (dnacCredentialsData) => {
    try {
        let hostName = dnacCredentialsData?.ip?.split("/");
        let aesEnabled = dnacCredentialsData?.aesAuthEnabled;
        const secretKey = dnacCredentialsData?.apiEncriptionKey
        let options;
        if (aesEnabled) {
            const username = dnacCredentialsData.username;
            const password = dnacCredentialsData.password;
            const auth = `${username}:${password}`;
            const cipherBase64 = encryptAES(auth, secretKey);
            options = {
                // hostname: hostName /* '10.122.1.25' */,
                hostname: hostName[2].toString() /* '10.122.1.25' */,
                path: dnacCredentialsData.authUrl,
                method: "POST",
                headers: {
                    Authorization: `CSCO-AES-256 credentials=${cipherBase64}`,
                },
                rejectUnauthorized: false
            };
        } else {
            options = {
                // hostname: hostName[1] /* '10.122.1.25' */,
                hostname: hostName[2].toString() /* '10.122.1.25' */,
                path: dnacCredentialsData.authUrl,
                method: "POST",
                rejectUnauthorized: false,
                headers: {
                    Authorization: "Basic " + Buffer.from(dnacCredentialsData.username + ":" + dnacCredentialsData.password).toString("base64"),
                },
            };
        };
        let result = await new Promise((resolve) => {
            var req = https.request(options, function (res) {
                // console.log("res",res)
                var data = [];
                res
                    .on("data", function (chunk) {
                        data.push(chunk);
                    })
                    .on("end", function () {
                        var buffer = Buffer.concat(data);
                        var str = iconv.decode(buffer, "windows-1252");

                        resolve(JSON.parse(str));
                    });
            });
            req.end();
            req.on("error", function (error) {
                if (error) {
                    return {
                        result: {

                            error: "ip is not valid.",
                            status: false,
                            tool: "DNA-C"
                        },
                    };
                }
                console.error("getting error is ", e);
            });
        });
        return result;
    } catch (err) {
        console.log("Error in getDnacToken in dnacHelper", err)
        let msg = `Error in getDnacToken in dnacHelper:${err}`
        let msg_output = { "msg": msg, status: false }
        return msg_output;
    }
};

export const commonCredentials = async (ip, dnacUrl = "") => {
    try {
        let db_connect = dbo && dbo.getDb()
        // let config = await db_config();
        let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "dnac": 1, "_id": 0 }).toArray();
        let deviceUUId = await db_connect.collection('ms_device').find({ $and: [{ source: "DNAC" }, { managementIpAddress: ip }, { "source_url": dnacUrl }]}).toArray();
        let switchUUID = deviceUUId[0]?.device_id
        // const { AUTH_API_URL, template_id } = config && config[0]?.dnac
        let AUTH_API_URL="/dna/system/api/v1/auth/token"
        let template_id="48967f32-a1de-46a0-a407-84164b8"
        let dnacDetailss = setUpDetails[0]?.dnac.filter((item) => item?.DnacURL === dnacUrl)
        let cli_command_url = `${dnacDetailss[0]?.DnacURL}/api/v1/network-device-poller/cli/read-request`;
        // let cli_command_url = dnacDetailss[0]?.DnacURL + config[0]?.dnac?.cli_command_read_request;
        // let deploy_temp_url = dnacDetailss[0]?.DnacURL + config[0]?.dnac?.DEPLOY_TEMPLATE_URL;
        // let temp_deploy_status_url = dnacDetailss[0]?.DnacURL + config[0]?.dnac?.TEMPLATE_STATUS;
        let deploy_temp_url = `${dnacDetailss[0]?.DnacURL}/dna/intent/api/v1/template-programmer/template/deploy`;
        let temp_deploy_status_url = `${dnacDetailss[0]?.DnacURL}/dna/intent/api/v1/template-programmer/template/deploy/status/`;
        let interfaceAPi = `${dnacDetailss[0]?.DnacURL}/dna/intent/api/v1/interface/network-device/`;
        // let interfaceAPi = dnacDetailss[0]?.DnacURL + config[0]?.dnac?.interfaceEndPoint + switchUUID;
        // console.log("cli_command_url",cli_command_url)
        let dnacCredentials = {
            authUrl: AUTH_API_URL,
            ip: dnacDetailss[0]?.DnacURL,
            username: dnacDetailss[0]?.DnacUserName,
            password: decript(dnacDetailss[0]?.DnacPassWord),
            aesAuthEnabled: dnacDetailss[0]?.is_aes_auth || false,
            apiEncriptionKey: dnacDetailss[0]?.secret_key || ""
        }
        let token = await getDnacToken(dnacCredentials);
        token = token?.Token
        // if(token){
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
            template_id
        }
        return obj;
        // }
    } catch (err) {
        console.log("Error in commanCredentials in dnacHelper", err)
        let msg = `Error in commanCredentials in dnacHelper:${err}`
        let msg_output = { "msg": msg, status: false }
        return msg_output;
    }
};

export const fileIDResponse = async (dnacUrl, device, taskOutput) => {
    try {
        let { token } = await commonCredentials(device, dnacUrl)
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
        console.log("error in fileIDResponse", err)
        return { data: "", msg: `Error msg in fileIDResponse:${err.message || err}`, status: false }
    }
};

export const taskResponse = async (dnacUrl, device, taskUrl) => {
    try {
        let { token } = await commonCredentials(device, dnacUrl)
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
        let msgOutput = { fileId: "", msg: `Error in taskResponse:${err.message || err}`, status: false }
        console.log("error in taskurl", err)
        return msgOutput
    }

}

export const dnacResponse = async (dnacUrl, device, ip) => {
    try {
        let { token, switchUUID } = await commonCredentials(device, dnacUrl)
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


        const response = await axios.request(config);
        if (Object.keys(response).length == 0 || Object.keys(response.data).length == 0 || Object.keys(response.data.response).length == 0 || response.data.response.url == "") {
            return { msg: "Unable to get task url", status: false }
        }
        let taskUrl = response.data.response.url
        let taskOutput = await taskResponse(dnacUrl, device, taskUrl)
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (Object.keys(taskOutput) == 0 || Object.keys(taskOutput).length == 0 || taskOutput.status == false) {
            // logger.error(taskOutput)
            return taskOutput
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        let fileOutput = await fileIDResponse(dnacUrl, device, taskOutput?.fileId)
        if (fileOutput.status == false) {
            // logger.error(fileOutput)
            return fileOutput
        }
        return fileOutput
    } catch (err) {
        let msgOutput = { data: "", msg: `Error in dnacResponse:${err.message || err},status:false` }
        return msgOutput
    }
}

export const execute_templates = async (item) => {
    try {
        let template_id = "48967f32-a1de-46a0-a407-84197a6064b8"
        let credData = await commonCredentials(item.device, item.dnac);
        const { token, deploy_temp_url, temp_deploy_status_url, switchUUID, dnacCredentials } = credData;

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        let data = {
            "templateId": template_id,
            "targetInfo": [
                {
                    "id": item.device, // Ensure this device ID is correct
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
        // console.log("Request Payload:", JSON.stringify(data, null, 2));

        // Send the POST request
        const response = await axios.request(config);
        // console.log("Response Status:", response.status);
        // console.log("Response Data:", JSON.stringify(response.data, null, 2));
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
                deployStatus = responses.data.devices[0].status
                if (deployStatus === "SUCCESS" || deployStatus === "FAILURE") {
                    excuteRes = true
                }
            }
            // await new Promise(resolve => setTimeout(resolve, 5000));
            return deployStatus
        }

        if (response.status !== 200) {
            console.log("Error: Request failed with status", response.status);
            return {msg:`Request failed with status ${response.status}`,status:false};
        }
        const deployment_id = response.data.deploymentId;
        return deployment_id;

    } catch (error) {
         console.log("Error: Request failed with status", response.status);
        return {msg:`Error in excute_template ${error.message}`,status:false};
    }
};


