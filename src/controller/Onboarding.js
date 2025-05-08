
import { v4 as uuidv4 } from 'uuid';
import https from "https";
import logger from '../../logger.js';
// import onboardingModel from "../../model/onboardingModel.js"
import dbo from "../db/conn.js";
import { commonCredentials } from '../helper/dnacHelper.js';
// import setUPModel from '../../model/setup_model.js';
// import inventoryModel from '../../model/inventoryModel.js';
import axios from "axios";
import onboardingModel from '../model/onboardingModel.js';
// import similarity from 'string-similarity';
import semver from 'semver';

export const allDnacDetails = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "dnac": 1, "_id": 0 }).toArray();
        if (setUpDetails?.length == 0 || setUpDetails[0].dnac?.length == 0) {
            let errorMsg = { data: [], msg: "Unable to get dnac data.", status: false }
            logger.error(errorMsg)
            return res.send(errorMsg)
        }
        res.json({
            data: setUpDetails && setUpDetails[0]?.dnac,
            msg: "Data get successfully",
            status: true
        })
    } catch (err) {
        let errorMsg = { data: [], msg: `Error msg in allDnacDetails:${err}`, status: false }
        logger.error(errorMsg)
        console.log(errorMsg)
        return res.send(errorMsg)
    }
};

export const onboardDeviceDetails = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        const { dnac } = req.body
        if (!dnac) {
            return res.status(400).json({
                msg: "Please select dnac.",
                status: false,
            });
        };

        let dnacUrlss = await db_connect.collection('ms_device').aggregate([
            { $match: { "source_url": dnac } },
            {
                $lookup: {
                    from: "ms_cmdb_devices",
                    localField: "managementIpAddress",
                    foreignField: "managementip",
                    as: "details"
                }
            }, {
                $unwind: "$details"
            },
            {
                $project: {
                    "managementIpAddress": 1,
                    "host_name": 1,
                    "device_type": 1,
                    "family": 1,
                    "device_id": 1,
                    "source_url": 1,
                    "serial_number": 1,
                    "details.region": 1,
                    "details.site": 1,
                    "details.site+": 1,
                    "details.floor": 1,
                    "details.room": 1,
                }
            },
        ]).toArray();

        if (dnacUrlss && dnacUrlss?.length == 0) {
            let errorMsg = { data: {}, msg: "Unable to get dnac device", status: false }
            logger.error(errorMsg)
            return res.send(errorMsg)
        }

        logger.info({ msg: "Data get successfully", status: true })
        return res.json({ data: dnacUrlss, msg: "Data get successfully", status: true })
    } catch (err) {
        let errorMsg = { data: [], msg: `Error msg in onboardDeviceDetails:${err}`, status: false }
        logger.error(errorMsg)
        console.log(errorMsg)
        return res.send(errorMsg)
    }

};


const checkEmptyKeyNotExist = async (obj) => {
    console.log("obj", obj)
    for (let key in obj) {
        if (obj[key] == null || obj[key] == "")
            return { msg: `Please provide ${obj[key]} value`, status: false };
    }
    return { msg: `Data get successfully`, status: true };
};


export const interfaces = async (switchUUID, dnacUrl, token) => {
    try {
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            // url: `${dnacUrl}/dna/intent/api/v1/interface/network-device/53219b68-e9e5-45aa-89d0-84ab9d521540`,
            url: `${dnacUrl}/dna/intent/api/v1/interface/network-device/${switchUUID}`,
            headers: {
                'x-auth-token': token
            },
            httpsAgent: httpsAgent
        };
        return axios.request(config)
            .then((response) => {
                const data = JSON.stringify(response.data);
                // console.log("sdfg", data);
                return data;
            })
            .catch((error) => {
                console.error(error);
                return null;
            });

    } catch (err) {
        console.log("Error in interfaces", err)
    }
};

export const dnacDeviceInterfaces = async (req, res) => {
    try {
        const { dnacUrl, device } = req.body;
        let commanCredential = await commonCredentials(device, dnacUrl)
        const { token, cli_command_url, AUTH_API_URL, switchUUID, dnacCredentials } = commanCredential
        let interfaceDetails = await interfaces(switchUUID, dnacUrl, token)
        let data = JSON.parse(interfaceDetails)
        if (data && data.length == 0) {
            let errorMsg = { msg: `Unable to get port from device`, status: false }
            logger.error(errorMsg)
            console.log(errorMsg)
        }
        let inter = []
        for (let item of data.response) {
            inter.push({ portName: item.portName })
        }
        res.send(inter)
    } catch (err) {
        let errorMsg = { msg: `Error msg in dnacDeviceInterface:${err}`, status: false }
        logger.error(errorMsg)
        console.log(errorMsg)
    }
};

export const execute_templates = async (template_id, item) => {
    try {
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
        } else {
            let temp_deploy_status_urls = temp_deploy_status_url + deployment_ids
            console.log("deployment_idssdfgh", deployment_ids)
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
            console.log("deployStatus", deployStatus)
            return deployStatus
        }

        if (response.status !== 200) {
            console.log("Error: Request failed with status", response.status);
            return;
        }
        const deployment_id = response.data.deploymentId;
        return deployment_id;

    } catch (error) {
        console.error("Error:", error);
    }
};

const configuration = (datass) => {
    if (datass.dayOnboardingMethod.includes("Access Switch")) {
        let config = `interface ${datass.interfaceID}\ndescription ${datass.otherParameter}\nswitchport mode trunk\nswitchport trunk allowed vlan ${datass.vlanID}\nno shutdown`
        return config
    } else {
        let config = `interface ${datass.interfaceID}\ndescription ${datass.otherParameter}\nswitchport mode trunk\nno shutdown`
        return config
    }

};

export const configDevicesInDnac = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        const datass = req.body
        if (Object.keys(datass).length == 0 || datass.interfaceID == "" || datass.otherParameter == "") {
            return res.json({
                msg: "Unable to get data from user.interface id and otherParameter keys are mandatory.",
                status: false

            })
        }

        let config = configuration(datass)
        if (!config || config == "") {
            return res.json({
                msg: "Unable to make config.",
                status: false
            })
        }
        datass["config"] = config
        datass["createdAt"] = new Date()
        datass["updatedAt"] = new Date()
        let saveData = await db_connect.collection("onboardingdata").insertOne(datass)
        let template_id = "48967f32-a1de-46a0-a407-84197a6064b8"
        let excute_templte = await execute_templates(template_id, datass)
        let msgs = {};
        if (excute_templte == "SUCCESS") {
            msgs = { msg: "Device configured successfully.", status: true }
        } else {
            msgs = { msg: "Unable to configured device.", status: false }
        }
        return res.json(msgs)
    } catch (err) {
        let errorMsg = { msg: `Error msg in configDevicesInDnac:${err}`, status: false }
        logger.error(errorMsg)
        console.log(errorMsg)
    }
};


export const getUnClaimedDevice = async (req, res) => {
    try {
        const { dnacUrl } = req.body;

        if (!dnacUrl) {
            return res.status(400).json({ msg: "Missing required fields: dnacUrl", status: false });
        }

        // Hardcoded IP for testing (replace with actual source)
        const dummyDeviceIp = "10.3.1.1";

        const credentialsData = await commonCredentials(dummyDeviceIp, dnacUrl);

        if (!credentialsData?.token) {
            return res.status(401).json({ msg: "Failed to fetch token from DNAC", status: false });
        }

        const urlPath = `/dna/intent/api/v1/onboarding/pnp-device`;
        // const urlPath = `/dna/intent/api/v1/onboarding/pnp-device?serialNumber=${serialNumber}`;
        const hostName = new URL(dnacUrl).hostname;

        const options = {
            hostname: hostName,
            path: urlPath,
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-Auth-Token": credentialsData.token
            },
            rejectUnauthorized: false // Use only in trusted environments with self-signed certs
        };

        const result = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = [];

                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    try {
                        const responseBody = Buffer.concat(data).toString();
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed);
                    } catch (e) {
                        reject({ msg: "Error parsing response from DNAC", error: e });
                    }
                });
            });


            req.on('error', (e) => {
                reject({ msg: "HTTPS request failed", error: e.message });
            });

            req.end();
        });
        return res.status(200).json({ status: true, data: result });

    } catch (err) {
        console.error("Error in getUnClaimedDevice:", err);
        return res.status(500).json({ msg: "Server error in getUnClaimedDevice", error: err.message, status: false });
    }
};


export const getDnacSites = async (req, res) => {
    try {
        const { dnacUrl } = req.body;

        if (!dnacUrl) {
            return res.status(400).json({ msg: "Missing 'dnacUrl' in request body", status: false });
        }

        // Use dummy IP just to pass to commonCredentials
        const dummyDeviceIp = "10.3.1.1";
        const creds = await commonCredentials(dummyDeviceIp, dnacUrl);

        if (!creds?.token) {
            return res.status(401).json({ msg: "Failed to fetch token from DNAC", status: false });
        }

        const sitePath = "/dna/intent/api/v1/site";
        const hostname = new URL(dnacUrl).hostname;

        const options = {
            hostname,
            path: sitePath,
            method: "GET",
            headers: {
                "X-Auth-Token": creds.token,
                "Content-Type": "application/json"
            },
            rejectUnauthorized: false // Needed for self-signed certs
        };

        const result = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                const chunks = [];

                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    try {
                        const responseBody = Buffer.concat(chunks).toString();
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed);
                    } catch (err) {
                        reject({ msg: "Error parsing response from DNAC", error: err });
                    }
                });
            });

            req.on('error', (e) => {
                reject({ msg: "HTTPS request failed", error: e.message });
            });

            req.end();
        });

        return res.status(200).json({ status: true, data: result });

    } catch (err) {
        console.error("Error in getDnacSites:", err);
        return res.status(500).json({ msg: "Internal Server Error", error: err.message, status: false });
    }
};


export const getImageID = async (dnacUrl) => {
    try {
        const dummyDeviceIp = "10.3.1.1";  //dummy
        const creds = await commonCredentials(dummyDeviceIp, dnacUrl);
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            // url: `${dnacUrl}/dna/intent/api/v1/interface/network-device/53219b68-e9e5-45aa-89d0-84ab9d521540`,
            url: `${dnacUrl}/dna/intent/api/v1/image/importation`,
            headers: {
                'x-auth-token': creds.token
            },
            httpsAgent: httpsAgent
        };
        return axios.request(config)
            .then((response) => {
                const data = JSON.stringify(response.data);
                // console.log("sdfg", data);
                return data;
            })
            .catch((error) => {
                console.error(error);
                return null;
            });

    } catch (err) {
        console.log("Error in getImageID", err)
        return { msg: `Error in getImageID:${err}`, status: false }
    }
};

export const getTemplate = async (dnacUrl) => {
    try {
        const dummyDeviceIp = "10.3.1.1";  //dummy
        const creds = await commonCredentials(dummyDeviceIp, dnacUrl);
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            // url: `${dnacUrl}/dna/intent/api/v1/interface/network-device/53219b68-e9e5-45aa-89d0-84ab9d521540`,
            url: `${dnacUrl}/dna/intent/api/v1/template-programmer/template`,
            headers: {
                'x-auth-token': creds.token
            },
            httpsAgent: httpsAgent
        };
        return axios.request(config)
            .then((response) => {
                const data = JSON.stringify(response.data);
                // console.log("sdfg", data);
                return data;
            })
            .catch((error) => {
                console.error(error);
                return null;
            });

    } catch (err) {
        console.log("Error in getTemplate", err)
        return { msg: `Error in getTemplate:${err}`, status: false }
    }
};

// function findBestMatch(targetValue, data, field = 'displayVersion', threshold = 0.95) {
//     let bestMatch = null;
//     let highestSimilarity = 0;

//     data.forEach(item => {
//         const valueToCompare = item[field];
//         const similarityScore = similarity.compareTwoStrings(targetValue, valueToCompare);

//         // Check if the similarity score is higher than the current highest
//         if (similarityScore > highestSimilarity && similarityScore >= threshold) {
//             highestSimilarity = similarityScore;
//             bestMatch = {
//                 name: item.name,
//                 displayVersion: item.displayVersion,
//                 similarityScore: similarityScore
//             };
//         }
//     });

//     return bestMatch;
// }

function findBestMatch(response, targetDisplayVersion) {
    // Find the item with the highest similarity score for displayVersion
    let bestMatch = null;
    let highestScore = 0;

    response.forEach(item => {
        const score = similarity.compareTwoStrings(targetDisplayVersion, item.displayVersion);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    });

    return bestMatch;
};

export const pnpSiteClaim = async (data, dnac) => {
    try {
        let dummydevice = "10.122.1.3"  //not in use
        let credData = await commonCredentials(dummydevice, dnac);
        const { token, deploy_temp_url, temp_deploy_status_url, switchUUID, dnacCredentials } = credData;

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${dnac}/dna/intent/api/v1/onboarding/pnp-device/site-claim`,
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            },
            data: data,
            httpsAgent: httpsAgent
        };
        const response = await axios.request(config);
        let deploymentIdsss = JSON.stringify(response.data, null, 2)
        deploymentIdsss = JSON.parse(deploymentIdsss)
        return deploymentIdsss

    } catch (err) {
        console.log("error in pnpSiteClaim", err)
        res.status(500).json({
            msg: "Internal server error in site claim",
            error: err.message,
            status: false
        });
    }
}

export const saveClaimSiteData = async (req, res) => {
    try {
        const payload = req.body;

        
        // const { deviceId, siteId, imageInfo, configInfo } = payload;
        // if (!deviceId || !siteId || !imageInfo || !configInfo) {
        //     return res.status(400).json({
        //         msg: "Missing required fields (deviceId, siteId, imageInfo, configInfo)",
        //         status: false,
        //     });
        // }
        for (let key in payload) {
            if (payload[key] == null || payload[key] == "")
                return res.send({ msg: `Please provide ${key} value`, status: false });
        }
        const db_connect = dbo && dbo.getDb();
        if (!db_connect) {
            return res.json({ msg: "Database connection failed", status: false });
        }

        let getTemplateID = await getTemplate(payload.dnacUrl)
        getTemplateID = JSON.parse(getTemplateID)
        let filterTemplate = getTemplateID.filter((item) => item.name == payload.template)
        if (!filterTemplate || filterTemplate.length == 0) {
            return res.json({ msg: "Unable to find template from dnac", status: false })
        }
        let getimageID = await getImageID(payload.dnacUrl)
        let parseData = JSON.parse(getimageID)
        let isTaggedGoldenFilterData = parseData.response.filter((item) => item.isTaggedGolden === true)
        // const targetDisplayVersion = payload?.goldenImage; // target version to search for
        // const bestMatch = findBestMatch(targetVersion, isTaggedGoldenFilterData, 'displayVersion', 0.95);

        // Display the best match
        // const bestMatch = findBestMatch(isTaggedGoldenFilterData, targetDisplayVersion);

        // Display the result
        // if (!bestMatch || Object.keys(bestMatch).length == 0) {
        //     console.log("No matching item found.");
        //     return res.json({ msg: "No matching item found for golden image id", status: false })
        // }
        const desiredVersion = payload?.goldenImage;
        function normalizeVersion(ver) {
            if (typeof ver !== 'string') return null;

            // Reject if any non-numeric (letter/symbol) appears
            if (!/^\d+(\.\d+){1,2}$/.test(ver)) return null;

            const parts = ver.split('.').map(Number);
            while (parts.length < 3) parts.push(0);
            return parts.slice(0, 3).join('.');
        }
        const exactMatch = isTaggedGoldenFilterData.filter(entry => {
            const normalizedEntryVersion = normalizeVersion(entry.displayVersion);
            const normalizedDesiredVersion = normalizeVersion(desiredVersion);
            if (!normalizedEntryVersion || !normalizedDesiredVersion) return false;
            return semver.eq(normalizedEntryVersion, normalizedDesiredVersion);
        });

        if (!exactMatch || exactMatch.length == 0) {
            console.log("No matching item found.");
            return res.json({ msg: "No matching item found for golden image id", status: false })
        }
        let imageUUId;
        for (let i = 0; i < exactMatch[0].applicableDevicesForImage.length; i++) {
            if (exactMatch[0].applicableDevicesForImage[i].productId.includes(payload.pid)) {
                console.log(true)
                imageUUId = exactMatch[0].imageUuid
                break;
            } else {
                console.log(false)
            }
        }
        if (!imageUUId || imageUUId == "") {
            return res.json({ msg: "Image id not found", status: false })
        }

        let data = {
            "deviceId": payload?.devideID,
            "siteId": payload?.site,
            "type": "Default",
            "imageInfo": {
                "imageId": imageUUId,
                "skip": true
            },
            "configInfo": [
                {
                    "configId": filterTemplate[0]?.templateId,
                    "configParameters": {
                        "Hostname": payload?.hostname,
                        "vtpversion": payload?.vtpVersion,
                        "vtpdomain": payload?.vtpDomainNam,
                        "vtppwd": payload?.vtpPassword,
                        "SPANMODE": payload?.stp,
                        "vlanid": payload?.mgmtVlanL2,
                        "MGMTINT": payload?.mgmtVlanL3Interface,
                        "ipaddress": payload?.mgmtL3IP,
                        "SNMPLocation": payload?.snmpLocation,
                        "LOGGINGHOST1": payload?.loggingHost1,
                        "LOGGINGHOST2": payload?.loggingHost2,
                        "uplinkinterface": payload?.accessUplink
                    }
                }
            ]
        }

        const timestamp = new Date();
        const documentToInsert = {
            ...payload,
            configData: data,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        let saveData = await db_connect.collection("siteclaimdata").insertOne(documentToInsert);
        console.log("saveData", saveData)

        //site-claim api
        // let pnpSiteDeviceClaim = await pnpSiteClaim(data, payload.dnacUrl)


        return res.status(200).json({ msg: "Data saved successfully", status: true });
    } catch (err) {
        console.error("Error in saveClaimSiteData:", err);
        logger.error({ msg: `Error in saveClaimSiteData: ${err}`, status: false })
        return res.status(500).json({ msg: `Error in saveClaimSiteData: ${err}`, status: false });
    }
};




export const postPnPDeviceSiteClaim = async (req, res) => {
    try {
        const {
            dnacUrl,
            deviceId,
            siteId,
            type,
            imageInfo,
            configInfo
        } = req.body;

        // Validate input
        if (!dnacUrl || !deviceId || !siteId || !type) {
            return res.status(400).json({
                msg: "Missing required fields (dnacUrl, deviceId, siteId, type)",
                status: false
            });
        }

        // Get token from common credentials
        const dummyDeviceIp = "10.3.3.3"; // Just needed for token lookup
        const creds = await commonCredentials(dummyDeviceIp, dnacUrl);
        if (!creds?.token) {
            return res.status(401).json({ msg: "Failed to get token from DNAC", status: false });
        }

        // Prepare request body
        const requestBody = {
            deviceId,
            siteId,
            type,
            imageInfo: imageInfo || {},
            configInfo: configInfo || []
        };

        const hostname = new URL(dnacUrl).hostname;
        const path = "/dna/intent/api/v1/onboarding/pnp-device/site-claim";

        const options = {
            hostname,
            path,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Auth-Token": creds.token
            },
            rejectUnauthorized: false // For self-signed certs
        };

        const result = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = [];
                response.on('data', chunk => data.push(chunk));
                response.on('end', () => {
                    try {
                        const responseBody = Buffer.concat(data).toString();
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed);
                    } catch (e) {
                        reject({ msg: "Error parsing DNAC response", error: e });
                    }
                });
            });

            request.on('error', (err) => {
                reject({ msg: "HTTPS request failed", error: err.message });
            });

            request.write(JSON.stringify(requestBody));
            request.end();
        });

        return res.status(200).json({ status: true, data: result });

    } catch (err) {
        console.error("Error in postPnPDeviceSiteClaim:", err);
        return res.status(500).json({
            msg: "Internal server error in site claim",
            error: err.message,
            status: false
        });
    }
};


// export const onboardDeviceDetails = async (req, res) => {
//     try {
//         console.log("aswedrfghj")
//         const db_connect = dbo && dbo.getDb();
//         let siteData = await db_connect.collection("ms_cmdb_devices").find({}).project({ "region": 1, "site": 1, "floor": 1, "room": 1, "_id": 0 }).toArray();
//         // const uniqueSiteDetails = [
//         //     ...new Map(siteData.map(item => [JSON.stringify(item), item])).values()
//         // ];
//         if (!siteData || siteData.length == 0) {
//             let errorMsg = { data: [], msg: "Data not found,Please insert site details.", status: false }
//             logger.error(errorMsg)
//             return res.send(errorMsg)
//         }

//         let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "dnac": 1, "_id": 0 }).toArray();
//         if (setUpDetails?.length == 0 || setUpDetails[0].dnac?.length == 0) {
//             let errorMsg = { data: {}, msg: "Unable to get dnac credentials", status: false }
//             logger.error(errorMsg)
//             return res.send(errorMsg)
//         }

//         let dnacUrlss = await db_connect.collection('ms_device').find({ "source": "DNAC" }).project({ "managementIpAddress": 1, "source_url": 1, "_id": 0, host_name: 1 }).toArray();
//         console.log("wedrftghj", dnacUrlss)
//         if (dnacUrlss && dnacUrlss?.length == 0) {
//             let errorMsg = { data: {}, msg: "Unable to get dnac device", status: false }
//             logger.error(errorMsg)
//             return res.send(errorMsg)
//         }
//         let obj = {
//             // siteDetails: uniqueSiteDetails,
//             siteDetails: siteData,
//             dnacDetails: setUpDetails && setUpDetails[0]?.dnac,
//             dnacDevice: dnacUrlss
//         }
//         logger.info({ msg: "Data get successfully", status: true })
//         return res.json({ data: obj, msg: "Data get successfully", status: true })


//     } catch (err) {
//         let errorMsg = { data: [], msg: `Error msg in onboardDeviceDetails:${err}`, status: false }
//         logger.error(errorMsg)
//         console.log(errorMsg)
//     }

// };











