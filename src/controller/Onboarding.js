
import { v4 as uuidv4 } from 'uuid';
import https from "https";
import logger from '../../logger.js';
import { logDnacResponse, logDnacError } from '../helper/logDnacResponse.js';
// import onboardingModel from "../../model/onboardingModel.js"
import dbo from "../db/conn.js";
import { commonCredentials, execute_templates, run_show_command_on_device } from '../helper/dnacHelper.js';
// import setUPModel from '../../model/setup_model.js';
// import inventoryModel from '../../model/inventoryModel.js';
import axios from "axios";
import onboardingModel from '../model/onboardingModel.js';
// import similarity from 'string-similarity';
import semver from 'semver';
import { log } from 'console';
import { sendError } from '../utils/errorHandler.js';
import dnacSitesModel from '../model/dnacSitesModel.js';




export const allDnacDetails = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "dnac": 1, "_id": 0 }).toArray();
        if (!setUpDetails || setUpDetails.length === 0 || !setUpDetails[0].dnac || setUpDetails[0].dnac.length === 0) {
            logger.error({ msg: "Unable to get dnac data.", status: false });
            return sendError(res, 404, "Unable to get dnac data.");
        }
        res.json({
            data: setUpDetails && setUpDetails[0]?.dnac,
            msg: "Data get successfully",
            status: true
        })
    } catch (err) {
        let errorMsg = { data: [], msg: `Error msg in allDnacDetails:${err}`, status: false }
        logger.error(errorMsg);
        return sendError(res, 500, 'Failed to fetch DNAC details');
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
            return sendError(res, 404, 'Unable to get DNAC device');
        }
        logger.info({ msg: "onboardDeviceDetails: DNAC data fetched successfully", count: dnacUrlss.length, status: true })
        return res.json({ data: dnacUrlss, msg: "Data get successfully", status: true })
    } catch (err) {
        logger.error({ msg: 'Error in onboardDeviceDetails', error: err, status: false });
        return sendError(res, 500, 'Failed to fetch DNAC details');
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
                logger.info({ msg: 'DNAC interfaces API call successful', dnacUrl, switchUUID, status: true });
                const data = JSON.stringify(response.data);
                return data;
            })
            .catch((error) => {
                logger.error({ msg: 'Error in interfaces', error: error, status: false });
                return null;
            });

    } catch (err) {
        logger.error({ msg: 'Error in getting interfaces', error: err, status: false });
        return null;
    }
};

export const dnacDeviceInterfaces = async (req, res) => {
    try {
        // const { dnacUrl, device } = req.body;
        let { dnacUrl, device } = req.body;
         device = device?.split(" ")[0]; // "10.28.33.7" from "10.28.33.7 (HTAINHYD06XXXCS001)"

        let commanCredential = await commonCredentials(device, dnacUrl)
        logDnacResponse('Onboarding.dnacDeviceInterfaces.commonCredentials', commanCredential);
        const { token, cli_command_url, AUTH_API_URL, switchUUID, dnacCredentials } = commanCredential
        let interfaceDetails = await interfaces(switchUUID, dnacUrl, token)
        if (!interfaceDetails) {
            logger.error({ msg: 'No interface details from DNAC', dnacUrl, status: false });
            return sendError(res, 500, 'Failed to fetch interface details from DNAC');
        }
        logDnacResponse('Onboarding.dnacDeviceInterfaces.interfaces', interfaceDetails);
        let data = JSON.parse(JSON.stringify(interfaceDetails));
        if (!data.response) {
            logger.error({ msg: 'Invalid response from DNAC', dnacUrl, status: false });
            return sendError(res, 500, 'Invalid response from DNAC');
        }
        let inter = []
        for (let item of data.response) {
            if (item.interfaceType == 'Physical' && (!item.description || item.description.trim() === '')) {
            inter.push({ portName: item.portName })
            }
        }
        logger.info({ msg: 'DNAC device interfaces fetched successfully', dnacUrl, count: inter.length, status: true });
        logger.debug({ msg: 'DNAC device interfaces details', dnacUrl, inter });
        logDnacResponse('Onboarding.dnacDeviceInterfaces.final', inter);
        res.send(inter)
    } catch (err) {
        logDnacError('Onboarding.dnacDeviceInterfaces', err);
        return sendError(res, 500, 'Failed to fetch device interfaces');
    }
};


// old code of onboard configration
// const configuration = (datass) => {
//     if (datass.dayOnboardingMethod.includes("Access Switch")) {
//         let config = `interface ${datass.interfaceID}\ndescription ${datass.otherParameter}\nswitchport mode trunk\nswitchport trunk allowed vlan ${datass.vlanID}\nno shutdown`
//         return config
//     } else {
//         let config = `interface ${datass.interfaceID}\ndescription ${datass.otherParameter}\nswitchport mode trunk\nno shutdown`
//         return config
//     }

// };

// export const configDevicesInDnac = async (req, res) => {
//     try {
//         const db_connect = dbo && dbo.getDb();
//         const datass = req.body
//         if (Object.keys(datass).length == 0 || datass.interfaceID == "" || datass.otherParameter == "") {
//             return res.json({
//                 msg: "Unable to get data from user.interface id and otherParameter keys are mandatory.",
//                 status: false

//             })
//         }

//         let config = configuration(datass)
//         if (!config || config == "") {
//             return res.json({
//                 msg: "Unable to make config.",
//                 status: false
//             })
//         }
//         datass["config"] = config
//         datass["createdAt"] = new Date()
//         datass["updatedAt"] = new Date()
//         let saveData = await db_connect.collection("onboardingdata").insertOne(datass)

//         let excute_templte = await execute_templates(datass)
//         // let excute_templte = await execute_templates(datass)
//         let msgs = {};
//         if (excute_templte == "SUCCESS") {
//             msgs = { msg: "Device configured successfully.", status: true }
//         } else {
//             msgs = { msg: "Unable to configured device.", status: false }
//         }
//         return res.json(msgs)
//     } catch (err) {
//         logger.error({ msg: 'Error in configDevicesInDnac', error: err, status: false });
//         return sendError(res, 500, 'Failed to configure device');
//     }
// };
    
    function normalizeInterfaceName(shortName) {
        if (shortName.startsWith("Gi")) return shortName.replace("Gi", "GigabitEthernet");
        if (shortName.startsWith("Te")) return shortName.replace("Te", "TenGigabitEthernet");
        if (shortName.startsWith("Fa")) return shortName.replace("Fa", "FastEthernet");
        if (shortName.startsWith("Ap")) return shortName.replace("Ap", "AppGigabitEthernet");
        return shortName; // fallback
    }
export function getStormControlValue(rawOutput) {
    const lines = rawOutput.split('\n');
    const stormValues = {};

    // Find header line
    const headerLine = lines.find(line => line.includes("Port") && line.includes("Speed"));
    const headerIndex = lines.indexOf(headerLine);

    if (headerIndex === -1) {
        logger.error({ msg: '❌ Header not found in getStormControlValue', status: false });
        return stormValues;
    }

    // Use regex to find start indexes of each column
    const headerCols = [...headerLine.matchAll(/\S+/g)].map(match => match.index);

    const portPos = headerCols[0];
    const namePos = headerCols[1];
    const statusPos = headerCols[2];
    const vlanPos = headerCols[3];
    const duplexPos = headerCols[4];
    const speedPos = headerCols[5];
    const typePos = headerCols[6];

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const iface = line.slice(portPos, namePos).trim();
        const speed = line.slice(speedPos, typePos).trim().toLowerCase();

        console.log(`Processing interface: ${iface}, Speed: ${speed}`);
        const normalizedIface = normalizeInterfaceName(iface);  // 👈 Add this

        let value = 0.03;

        if (speed.includes("10g") || speed.includes("20g") || speed.includes("25g")) {
            value = 0.30;
        } else if (speed.includes("1000") || speed.includes("a-1000") || speed.includes("-1000") || speed === "auto") {
            value = 3.0;
        }

        stormValues[normalizedIface] = value;
    }

    // console.log(stormValues, "📂 Storm Values:");
    return stormValues;
}


const configuration = async(datass) => {
    let configLines = [];

    if (!datass.cleanedData || datass.cleanedData.length === 0) return "";
    const output = await run_show_command_on_device(datass.dnac, datass.device, "show interfaces status");
    // const output = await run_show_command_on_device(datass.dnac,"10.122.1.2","show interfaces status");
    const getstormvalue = getStormControlValue(output.output);
    datass.cleanedData.forEach((row) => {
        const ifaceStr = row.interfaceID;
        const vlan = row.vlanID;
        const desc = datass.otherParameter || "PNP-Reserved-PORT";

        // Split interfaces by comma
        const interfaces = ifaceStr.split(",").map((i) => i.trim());

        interfaces.forEach((iface) => {
            const normalizedIface = normalizeInterfaceName(iface);
            const stormVal = getstormvalue?.[normalizedIface] || 0.03;

            let config = "";

            if (datass.dayOnboardingMethod.includes("Access Switch")) {
                config = `interface ${iface}
description ${desc}
switchport access vlan ${vlan}
switchport mode access`;
            } else {
                config = `interface ${iface}
description ${desc}
switchport mode trunk
logging event trunk-status`;
            }
             config += `
storm-control broadcast level ${stormVal}
storm-control multicast level ${stormVal}
spanning-tree guard root
no shutdown`;

            configLines.push(config);
        });
    });
    logger.info({ msg: 'Generated configuration', config: configLines.join("\n\n") });
    
    return configLines.join("\n");
};


export const configDevicesInDnac = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let datass = req.body;

        // Validation
        if (!datass.cleanedData || datass.cleanedData.length === 0) {
            return sendError(res, 400, 'Missing required \'rows\' data.');
        }

        const validRows = datass.cleanedData.every(
            (row) => row.interfaceID && row.vlanID
        );

        if (!validRows) {
            return sendError(res, 400, 'Invalid data in \'rows\'.');
        }

        // Extract IP and hostname from device string
        const deviceIp = datass.device?.value?.split(" ")[0] || "";
        const hostnameMatch = datass.device?.value?.match(/\((.*?)\)/);
        const hostname = hostnameMatch ? hostnameMatch[1] : "";

        // Update values
        datass.device = deviceIp;
        datass.hostname = hostname;
        // Generate configuration
        let config = await configuration(datass);
        logger.info(config);
        if (!config || config === "") {
            return sendError(res, 400, 'Configuration not generated.');
        }
        // console.log(config, "Generated Configuration");
        

        datass["config"] = config;
        datass["pnpClaim"] = false; 
        datass["createdAt"] = new Date();
        datass["updatedAt"] = new Date();

        // Save data
        await db_connect.collection("onboardingdata").insertOne(datass);

        // Execute templates
        let excute_templte = await execute_templates(datass);
        logger.info({ msg: 'DNAC configDevicesInDnac: execute_templates called', status: !!excute_templte });
        let msgs = {};

        if (excute_templte === "SUCCESS") {
            msgs = { msg: "Device configured successfully.", status: true };
        } else {
            msgs = { msg: "Unable to configure device.", status: false };
        }

        return res.json(msgs);
    } catch (err) {
        logger.error({ msg: 'Error in configDevicesInDnac', error: err, status: false });
        return sendError(res, 500, 'Failed to configure device');
    }
};

export const getUnClaimedDevice = async (req, res) => {
    try {
        const { dnacUrl,serialNumber } = req.body;

        if (!dnacUrl && !serialNumber) {
            return sendError(res, 400, 'Missing required fields: dnacUrl');
        }

        // Hardcoded IP for testing (replace with actual source)
        const dummyDeviceIp = "";
        const credentialsData = await commonCredentials(dummyDeviceIp, dnacUrl);
        logDnacResponse('Onboarding.getUnClaimedDevice.commonCredentials', credentialsData);
        if (!credentialsData?.token) {
            logDnacError('Onboarding.getUnClaimedDevice', { msg: 'Failed to fetch token from DNAC', credentialsData });
            return sendError(res, 400, 'Failed to fetch token from DNAC');
        }
        const limit = 50;
        let offset = 0;
        let allDevices = [];

        while (true) {
            // const urlPath = `/dna/intent/api/v1/onboarding/pnp-device`;
            const urlPath = `/dna/intent/api/v1/onboarding/pnp-device?serialNumber=${serialNumber}&state=Unclaimed`;
            const hostName = new URL(dnacUrl).hostname;
            const httpsAgent = new https.Agent({
                rejectUnauthorized: false
            });
            const options = {
                hostname: hostName,
                path: urlPath,
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "X-Auth-Token": credentialsData.token
                },
                rejectUnauthorized: false // Use only in trusted environments with self-signed certs
                // httpsAgent: httpsAgent
            };

            const result = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = [];

                    res.on('data', chunk => data.push(chunk));
                    res.on('end', () => {
                        try {
                            const responseBody = Buffer.concat(data).toString();
                            const parsed = JSON.parse(responseBody);
                            resolve(parsed || []);
                        } catch (e) {
                            reject({ msg: "Error parsing response from DNAC", error: e });
                        }
                    });
                });

                req.on('error', (e) => reject({ msg: "HTTPS request failed", error: e.message }));
                req.end();
            });


            allDevices.push(...result);
            offset += limit;
            if (result.length < limit) break;
        }

        const formatted = allDevices.map(device => ({
            id: device.id,
            ...device.deviceInfo,
            ...device.progress
        }));

        logger.info({ msg: 'DNAC getUnClaimedDevice API call successful', dnacUrl, count: formatted.length, status: true });
        logDnacResponse('Onboarding.getUnClaimedDevice.final', formatted);
        return res.status(200).json({
            status: true,
            data: formatted
        });
    } catch (err) {
        logDnacError('Onboarding.getUnClaimedDevice', err);
        return sendError(res, 500, 'Failed to fetch unclaimed devices');
    }
};


// export const getUnClaimedDevice = async (req, res) => {
//     try {
//         const { dnacUrl } = req.body;

//         if (!dnacUrl) {
//             return sendError(res, 400, 'Missing required fields: dnacUrl');
//         }
//         const db_connect = dbo && dbo.getDb();
//         if (!db_connect) {
//             return sendError(res, 500, 'Database connection failed');
//         }

//        const devices = await db_connect
//             .collection("onboardingdata")
//             .find({ pnpClaim: false, dnac: dnacUrl })
//             .toArray();

//         return res.json({
//             msg: "Unclaimed devices fetched successfully.",
//             status: true,
//             data: devices
//         });


//     } catch (err) {
//         logger.error({ msg: "Error in getUnClaimedDevice", error: err, status: false });
//         return sendError(res, 500, 'Failed to fetch unclaimed devices');
//     }
// };



export const getDnacSites = async (req, res) => {
    try {
        const { dnacUrl } = req.body;

        if (!dnacUrl) {
            return sendError(res, 400, 'Missing \'dnacUrl\' in request body');
        }

        // // Use dummy IP just to pass to commonCredentials
        // const dummyDeviceIp = "";
        // const creds = await commonCredentials(dummyDeviceIp, dnacUrl);

        // if (!creds?.token) {
        //     return sendError(res, 400, 'Failed to fetch token from DNAC');
        // }

        // const sitePath = "/dna/intent/api/v1/site";
        // const hostname = new URL(dnacUrl).hostname;

        // const options = {
        //     hostname,
        //     path: sitePath,
        //     method: "GET",
        //     headers: {
        //         "X-Auth-Token": creds.token,
        //         "Content-Type": "application/json"
        //     },
        //     rejectUnauthorized: false // Needed for self-signed certs
        // };

        // const result = await new Promise((resolve, reject) => {
        //     const req = https.request(options, (res) => {
        //         const chunks = [];

        //         res.on('data', chunk => chunks.push(chunk));
        //         res.on('end', () => {
        //             try {
        //                 const responseBody = Buffer.concat(chunks).toString();
        //                 const parsed = JSON.parse(responseBody);
        //                 resolve(parsed);
        //             } catch (err) {
        //                 reject({ msg: "Error parsing response from DNAC", error: err });
        //             }
        //         });
        //     });

        //     req.on('error', (e) => {
        //         reject({ msg: "HTTPS request failed", error: e.message });
        //     });

        //     req.end();
        // });
        const result = await dnacSitesModel.find({ dnacUrl }).lean();


        return res.status(200).json({ status: true, data: {response: result }});

    } catch (err) {
        logger.error({ msg: "Error in getDnacSites", error: err, status: false });
        return sendError(res, 500, 'Failed to fetch DNAC sites');
    }
};


export const getImageID = async (dnacUrl) => {
    try {
        const dummyDeviceIp = "";  //dummy
        const creds = await commonCredentials(dummyDeviceIp, dnacUrl);
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            // url: `${dnacUrl}/dna/intent/api/v1/interface/network-device/53219b68-e9e5-45aa-89d0-84ab9d521540`,
            url: `${dnacUrl}/dna/intent/api/v1/image/importation?isTaggedGolden=true`,
            headers: {
                'x-auth-token': creds.token
            },
            httpsAgent: httpsAgent
        };
        return axios.request(config)
            .then((response) => {
                logger.info({ msg: 'DNAC getImageID API call successful', response });
                return response.data;
            })
            .catch((error) => {
                logger.error({ msg: 'Error in getImageID', error: error });
                return null;
            });

    } catch (err) {
        logger.error({ msg: 'Error in getImageID', error: err, status: false });
        return { msg: `Error in getImageID:${err}`, status: false }
    }
};

export const getTemplate = async (dnacUrl) => {
    try {
        const dummyDeviceIp = "";  //dummy
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
                logger.info({ msg: 'DNAC getTemplate API call successful', dnacUrl, status: true });
                const data = JSON.stringify(response.data);
                return data;
            })
            .catch((error) => {
                logger.error({ msg: 'Error in getTemplate', error: error, status: false });
                return null;
            });

    } catch (err) {
        logger.error({ msg: 'Error in getTemplate', error: err, status: false });
        return { msg: `Error in getTemplate:${err}`, status: false }
    }
};

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
        let dummydevice = ""  //not in use 
        let credData = await commonCredentials(dummydevice, dnac);
        const { token} = credData;

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
            data:JSON.stringify(data),
            httpsAgent: httpsAgent
        };

        const response = await axios.request(config);
        logger.info({ msg: 'DNAC pnpSiteClaim API call successful', dnac, status: true });
        return {
            statusCode: response.status,
            message: "Success",
            data: response.data
        };

    } catch (err) {
        logger.error({ msg: 'Error in pnpSiteClaim', error: err, status: false });
        const statusCode = err.response?.status || 500;
        const message = "Error in pnpSiteClaim";
        return {
            statusCode,
            message,
            error: true,
            details: err.response?.data || {}
        };  
    }
}

export const saveClaimSiteData = async (req, res) => {
    try {


        const payload = req.body;
        for (let key in payload) {
                if (payload[key] == null || payload[key] == "")
                    return sendError(res, 400, `Please provide ${key} value`);
            }
            const db_connect = dbo && dbo.getDb();
            if (!db_connect) {
                return sendError(res, 500, 'Database connection failed');
            }
            

        let getTemplateID = await getTemplate(payload.dnacUrl)
        logger.info({ msg: 'DNAC getTemplate called in saveClaimSiteData', dnacUrl: payload.dnacUrl, status: true });
        logger.error('template data from DNAC',JSON.stringify(getTemplateID,null,2));
        let filterTemplate;
        if (getTemplateID) {
            getTemplateID = JSON.parse(getTemplateID)
            filterTemplate = getTemplateID.filter((item) => item.name == payload.template)
        }
        if (!filterTemplate || filterTemplate.length == 0) {
            return sendError(res, 404, 'Unable to find template from DNAC');
        }

        let data = {
            "deviceId": payload?.devideID,
            "device":   payload?.device,
            "siteId": payload?.site,
            "imageInfo": {
                "imageId": payload?.imageUuid,
            },
            "type": "Default",
            "configInfo": {
                "configId": filterTemplate && filterTemplate[0] && filterTemplate[0].templateId ,
                // "configId":  payload.template,

                "configParameters": [
                    {
                        "key": "vtpversion",
                        "value": payload?.vtpVersion
                    },
                    {
                        "key": "ipaddress",
                        "value": payload?.mgmtL3IP
                    },
                    {
                        "key": "vtpdomain",
                        "value": payload?.vtpDomainName
                    },
                    {
                        "key": "vtppwd",
                        "value": payload?.vtpPassword
                    },
                    {
                        "key": "uplinkinterface",
                        "value": payload?.accessUplink
                    },
                    {
                        "key": "LOGGINGHOST1",
                        "value": payload?.loggingHost1
                    },
                    {
                        "key": "ipmask",
                        "value": payload.mgmtL3Subnet
                    },
                    {
                        "key": "SNMPLocation",
                        "value": payload?.snmpLocation
                    },
                    {
                        "key": "LOGGINGHOST2",
                        "value": payload?.loggingHost2
                    },
                    {
                        "key": "vlanid",
                        "value": payload?.mgmtVlanL2
                    },
                    {
                        "key": "MGMTINT",
                        "value": payload?.mgmtVlanL3Interface
                    },
                    {
                        "key": "SPANMODE",
                        "value": payload?.stp
                    },
                    {
                        "key": "Hostname",
                        "value": payload?.hostname
                    }

                ]
            }
        }
        console.log("claim payload: ", JSON.stringify(data, null, 2))
        const timestamp = new Date();
        const documentToInsert = {
            ...payload,
            configData: data,
            claimStatus: false,
            createdAt: timestamp,
            updatedAt: timestamp,
            dayNBoarding:false,
            // userInfo: {
            //     username: userInfo?.username || '',
            //     role: userInfo?.role || '',
            //     email: userInfo?.sub || ''
            // }
        };
        // Check existing data
        //  const existingData = await db_connect.collection("siteclaimdata").find({
        //     mgmtL3IP: payload.mgmtL3IP,
        //     dnacUrl: payload.dnacUrl,
        // }).toArray();
        // // If found, mark them deleted
        // if (existingData.length > 0) {
        //     await db_connect.collection("siteclaimdata").updateMany(
        //         {
        //     mgmtL3IP: payload.mgmtL3IP,
        //     dnacUrl: payload.dnacUrl,
        //         },
        //         {
        //             $set: { isDeleted: true, updatedAt: new Date() }
        //         }
        //     );
        // }
        let saveData = await db_connect.collection("siteclaimdata").insertOne(documentToInsert);
        console.log("saveData", saveData)
        //site-claim api
        let pnpResponse = await pnpSiteClaim(data, payload.dnacUrl)
        logger.info({ msg: 'DNAC pnpSiteClaim called in saveClaimSiteData', dnacUrl: payload.dnacUrl, status: true });                //     data: {
                //         deviceId: payload.devideID,
                //         siteId: payload.site,
                //         type: "Default",
                //         configInfo: data.configInfo
                //     }
                // }
        const { statusCode, message, data: responseData } = pnpResponse;
        // If DNAC returns success, update claimStatus = true
        if (statusCode >= 200 && statusCode < 300) {
            await db_connect.collection("siteclaimdata").updateOne(
                { _id: saveData.insertedId },
                {
                    $set: {
                        claimStatus: true,
                        updatedAt: new Date()
                    }
                }
            );

            return res.status(statusCode).json({
                msg: "Device claimed successfully",
                status: true,
                data: responseData || {}
            });
        }
        return res.status(statusCode || 500).json({
            msg: `Site claim failed from DNAC: ${message || "Unknown error"}`,
            status: false,
            error: pnpResponse?.details || {}
        });

    } catch (err) {
        logger.error({ msg: 'Error in saveClaimSiteData', error: err, status: false });
        return sendError(res, 500, 'Failed to claim site');
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
            return sendError(res, 400, 'Missing required fields (dnacUrl, deviceId, siteId, type)');
        }

        // Get token from common credentials
        const dummyDeviceIp = ""; // Just needed for token lookup
        const creds = await commonCredentials(dummyDeviceIp, dnacUrl);
        if (!creds?.token) {
            return sendError(res, 401, 'Failed to get token from DNAC');
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
        logger.error({ msg: 'Error in postPnPDeviceSiteClaim', error: err, status: false });
        return sendError(res, 500, 'Failed to claim site');
    }
};




export const sendMailForScreenShot = async (req, res) => {
    try {
        const data = req.body
        const dat1 = req.files
        console.log(data, "data")
        console.log(dat1, "dat1")
        setImmediate(async () => {
            try {
                // Email to User
                const userSubject = `Link to Download ${downloadFor}`;
                const userHtml = `
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Verdana', sans-serif; background-color: #f4f4f4; color: #333; }
                            .email-container { background-color: #fff; border: 1px solid #cccccc; padding: 20px; margin: 20px auto; width: 650px; }
                            .header { text-align: center; }
                            .header img { width: 650px; height: 100px; }
                            .content { font-size: 14px; color: #333; line-height: 1.6; }
                            .footer { text-align: center; font-size: 12px; color: #888; margin-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                <img src="http://files.velocis.in/mailer/vAutomate/vAutomateEmailBanner.png" alt="Agilus">
                            </div>
                            <div class="content">
                                <p>Dear ${name},</p>
                                <p>Greetings of the day!</p>
                                <p>Thank you for your interest in ${downloadFor}. 
                                <a href="#" onclick="checkMail(true)" target="_blank">Click here</a> to download.
                                </p>
                                <p>Best regards,</p>
                                <p>Team Agilus</p>
                                <img src='https://www.agilustech.in/static/media/Agilus---Logo.f0cf7ef4cd7edadacb62.png' alt="Agilus Logo" style="height: 30px;">
                            </div>
                        </div>
                    </body>
                    </html>
                `;
                await sendEmail({ to: mail, subject: userSubject, data: { name, html: userHtml } });

            } catch (error) {
                logger.error({ msg: 'Error sending email', error: error, status: false });
            }
        });

    } catch (err) {
        logger.error({ msg: 'Error in send mail', error: err, status: false });
        return sendError(res, 500, 'Failed to send email');
    }

}


// export const onboardDeviceDetails = async (req, res) => {
//     try {
//         console.log("aswedrfghj")
//         const db_connect = dbo && dbo.getDb();
//         let siteData = await db_connect.collection("ms_cmdb_devices").find({}).project({ "region": 1, "site": 1, "floor": 1, "room": 1, "_id": 0 }).toArray();
//         // const uniqueSiteDetails = [
//         //     ...new Map(siteData.map(item => [JSON.stringify(item), item])).values()
//         // ];
//         if (!siteData || siteData.length == 0) {
//             return sendError(res, 404, 'Data not found,Please insert site details.');
//         }

//         let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "dnac": 1, "_id": 0 }).toArray();
//         if (setUpDetails?.length == 0 || setUpDetails[0].dnac?.length == 0) {
//             return sendError(res, 404, 'Unable to get dnac credentials');
//         }

//         let dnacUrlss = await db_connect.collection('ms_device').find({ "source": "DNAC" }).project({ "managementIpAddress": 1, "source_url": 1, "_id": 0, host_name: 1 }).toArray();
//         console.log("wedrftghj", dnacUrlss)
//         if (dnacUrlss && dnacUrlss?.length == 0) {
//             return sendError(res, 404, 'Unable to get dnac device');
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
//         logger.error({ msg: 'Error in onboardDeviceDetails', error: err, status: false });
//         return sendError(res, 500, 'Failed to fetch device details');
//     }

// };


export const getPnpDevices = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();

        // Fetch the latest document from ms_pnp_data
        const latestDoc = await db_connect.collection('pe_devices_config').find({}).toArray();

        if (!latestDoc) {
            return sendError(res, 404, 'No PE_DEVICE_DAY_0 data found.');
        }

        const formattedDevices = latestDoc.map(device => {
            const hostname = device.pe_hostname ?? 'unknown';
            const pnpIP = device.pnp_ip_address ?? '0.0.0.0';
            return `${hostname} (${pnpIP})`;
        });

        return res.status(200).json({ devices: formattedDevices });

    } catch (err) {
        logger.error({ msg: 'Error in getPnpDevices', error: err, status: false });
        return sendError(res, 500, 'Failed to fetch PNP devices');
    }
};

export const getFloorValue = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();

        // Fetch the latest document from ms_pnp_data
        const latestDoc = await db_connect.collection('pe_devices_config').find({}).toArray();

        if (!latestDoc) {
            return sendError(res, 404, 'No PE_DEVICE_DAY_0 data found.');
        }

        // const formatted = latestDoc.PE_DEVICE_DAY_0.map(device => {
        //     return `${device.list_of_floor ?? 'unknown'})`;
        // });
        const formatted = [...new Set(latestDoc.map(d => d.list_of_floor ?? 'unknown'))].map(f => `${f}`);


        return res.status(200).json({ data: formatted });

    } catch (err) {
        logger.error({ msg: 'Error in getFloorValue', error: err, status: false });
        return sendError(res, 500, 'Failed to fetch floor values');
    }
};

export const getTemplatesByFloor = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let siteQuery = req.query.name; // ?name=Lucknow - SkillDevelopmentCenter Block 1)

        if (!siteQuery) {
            return sendError(res, 400, 'Site name is required in query');
        }

        // Fetch template array from DB
        const templates = await db_connect.collection("template_mapping").find().toArray();

        if (templates.length === 0) {
            return sendError(res, 404, 'Template data not found in DB');
        }

        // Normalize siteQuery: handle "Bengaluru" → "Bangalore"
        siteQuery = siteQuery.toLowerCase().replace('bengaluru', 'bangalore');
        siteQuery = siteQuery.toLowerCase().replace('Mumbai','Navi Mumbai');


        const matchedTemplates = templates.filter(template => {
            return siteQuery.toLowerCase().includes(template.site.toLowerCase());
        });

        if (!matchedTemplates.length) {
            return sendError(res, 404, 'No matching templates found for the given site');
        }

        return res.status(200).json(matchedTemplates);

    } catch (err) {
        logger.error({ msg: 'Error in getTemplatesByFloor', error: err, status: false });
        return sendError(res, 500, 'Failed to fetch templates by floor');
    }
};


// Controller
export const getDeviceDetails = async (req, res) => {
  try {
    const { hostname, ip, site } = req.query;
    if (!site && !hostname && !ip) {
      return sendError(res, 400, 'Provide at least one search parameter');
    }

    const db_connect = dbo.getDb(); // assume `dbo` is your db instance

    const query = {
      "name": "pnp_data", // Assuming you are looking for a specific document
      "PE_DEVICE_DAY_0": {
        $elemMatch: {
        //   ...(hostname && { pe_hostname: hostname }),
          ...(ip && { pe_ip: ip }),
        //   ...(site && { list_of_floor: site }),
        },
      },
    };

    const doc = await db_connect.collection("pe_devices_config").findOne({ pe_ip: ip });

    if (!doc) return sendError(res, 404, 'Device not found');

    // const matchedDevice = doc.PE_DEVICE_DAY_0.find(dev =>
    //   (!hostname || dev.pe_hostname === hostname) &&
    //   (!ip || dev.pe_ip === ip) &&
    //   (!site || dev.list_of_floor === site)
    // );

    if (!doc) return sendError(res, 404, 'Device not matched in array');

    res.json(doc);
  } catch (err) {
    logger.error({ msg: 'Error in getDeviceDetails', error: err, status: false });
    return sendError(res, 500, 'Failed to fetch device details');
  }
};




export const getAllLocations = async (req, res) => {
    try {
        const db = dbo && dbo.getDb();
        const collection = db.collection('pe_devices_config');

        const documents = await collection.find({}).toArray();
        if (documents.length === 0) {
            return sendError(res, 404, 'No data found');
        }

        let locations = new Set();

        documents.forEach(r => {
            if (r.region) {
                locations.add(r.region.trim());
            }
        });

        return res.status(200).json({
            success: true,
            locations: [...locations]
        });

    } catch (error) {
        logger.error({ msg: 'Error in getAllLocations', error, status: false });
        return sendError(res, 500, 'Failed to fetch all locations');
    }
};


export const getDevicesByLocation = async (req, res) => {
    const { location,onboard } = req.query;
    if (onboard === 'Use Shared Switch (Access Switch - 9300)') {
        return res.status(400).json({ success: true,devices: [] });
    }

    if (!location) {
        return sendError(res, 400, 'Location query param is required');
    }

    try {
        const db = dbo && dbo.getDb();
        const collection = db.collection('pe_devices_config');

        const documents = await collection.find({}).toArray();
        if (!documents.length === 0) {
            return sendError(res, 404, 'No data found');
        }

        let devices = [];

        let filtered = documents.filter(r => 
            r.region?.trim().toLowerCase() === location.trim().toLowerCase() &&
            r.pe_ip && r.pe_hostname
        );

        devices = devices.concat(filtered.map(r => ({
            peIP: r.pe_ip,
            hostname: r.pe_hostname
        })));

        return res.status(200).json({
            success: true,
            location,
            // count: devices.length,
            devices
        });

    } catch (error) {
        logger.error({ msg: 'Error in getDevicesByLocation', error, status: false });
        return sendError(res, 500, 'Failed to fetch devices by location');
    }
};


export const getDeviceInfo = async (req, res) => {
    let { pe_ip, hostname } = req.query;

    if (!pe_ip && !hostname) {
        return sendError(res, 400, 'pe_ip or hostname is required');
    }

    try {
        // ✅ Clean the pe_ip if it contains anything extra (e.g. "10.28.33.7 (hostname)")
        if (pe_ip) {
            pe_ip = pe_ip.split(" ")[0].trim(); // gets only the IP part before the space
        }

        const db = dbo && dbo.getDb();
        const collection = db.collection('pe_devices_config');

        const document = await collection.findOne({ pe_ip:pe_ip});

        if (!document) {
            return sendError(res, 404, 'No data found');
        }

        // for (const sheet in document) {
        //     const rows = document[sheet];
        //     if (Array.isArray(rows)) {
                
        //     }
        // }

        const found  = document

        if (found) {
            const metadata = await db.collection("ms_cmdb_devices").findOne({
                managementip: found.pe_ip,
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    region: metadata?.region || null,
                    site: metadata?.site || '',
                    site_plus: metadata?.["site+"] || '',
                    floor: found.list_of_floor,
                    "PE": found.pe_hostname || null,
                    "IP": found.pe_ip || null,
                    "Serial": metadata?.serial_number || '',
                    vlan: found.vlan,
                    reserved_seed_ports: found.reserved_seed_ports || null
                }
            });
        }

        return res.status(404).json({ success: false, message: "Device not found" });

    } catch (error) {
        logger.error({ msg: 'Error in getDeviceInfo', error, status: false });
        return sendError(res, 500, 'Failed to fetch device information');
    }
};











