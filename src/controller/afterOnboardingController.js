import logger from '../../logger.js';
// import onboardingModel from "../../model/onboardingModel.js"
import dbo from "../db/conn.js";
import { callMgmtIpUpdateApi, callSyncDevicesApi, dnacResponse, run_show_command_on_device, updateMgmtAddressHelper } from '../helper/dnacHelper.js';
import https from "https";
import axios from "axios";
import { execute_templates } from '../helper/dnacHelper.js';
import { commonCredentials } from '../helper/dnacHelper.js';
import base64 from "base-64";
import * as xlsx from 'xlsx';
// import xlsx from "xlsx";
import fs from "fs"
import path from "path"
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { dnacDeviceInterfaces, getImageID, getStormControlValue, interfaces } from './Onboarding.js';
import { sendError } from '../utils/errorHandler.js';
import { log } from 'console';
import { logDnacResponse } from '../helper/logDnacResponse.js';



// const base64 = require('base-64');



// export const deviceDetails = async (req, res) => {
//     try {
//         const db_connect = dbo && dbo.getDb();
//         let setUpDetails = await db_connect.collection('ms_device').find({ "source": "DNAC" }).toArray();
//         if (!setUpDetails || setUpDetails?.length == 0) {
//             logger.error({ data: [], msg: "Unable to get dnac data.", status: false })
//             return sendError(res, 404, 'No DNAC data found');
//         }
//         res.json({
//             data: setUpDetails,
//             msg: "Data get successfully",
//             status: true
//         })
//     } catch (err) {
//         logger.error({ data: [], msg: `Error msg in deviceDetails:${err}`, status: false })
//         return sendError(res, 500, 'Failed to process configuration details');
//     }
// };

export const deviceDetails = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();

        let claimedDevices = await db_connect
            .collection("siteclaimdata")
            .find({claimStatus:true })
            .toArray();

        claimedDevices.forEach(device => {
            device.source_url = device.dnacUrl || "";
            device.managementIpAddress = device.mgmtL3IP || "";
            device.serial_number = device.serialNumber || "";
            device.host_name =device.hostname || "";
        });

        return res.json({
            msg: "Claimed devices fetched successfully.",
            status: true,
            data: claimedDevices
        });
    } catch (err) {
        const errorMsg = { msg: `Error in getClaimedDevices: ${err}`, status: false };
        logger.error(errorMsg);
        console.log(errorMsg);
        return sendError(res, 500, 'Failed to fetch claimed devices');
    }
};


export const getSiteClaimAndPnpTemplateBySourceUrl = async (req, res) => {
    try {
        const db_connect = dbo.getDb(); // get your db connection
        const snmpLocation = req.query.snmpLocation;

        // if (!source_url) {
        //     return res.status(400).json({ error: "Missing source_url in query" });
        // }

        // // Step 1: Get the latest record from siteclaimdata by dnacUrl
        // const siteClaimCollection = db_connect.collection("siteclaimdata");
        // const latestSiteClaim = await siteClaimCollection
        //     .find({ dnacUrl: source_url })
        //     .sort({ createdAt: -1 })
        //     .limit(1)
        //     .toArray();

        // if (!latestSiteClaim.length) {
        //     return res.status(404).json({ message: "No siteclaimdata found for source_url" });
        // }

        // const siteClaim = latestSiteClaim[0];
        // const snmpLocation = siteClaim.snmpLocation;

        if (!snmpLocation) {
            return res.status(404).json({ message: "SNMP location not found" });
        }

        // Step 2: Find a match in ms_pnp_data collection inside PNP_Template_DAY_N array
        const pnpCollection = db_connect.collection("dayN_configs");

        const matchedRecord = await pnpCollection.findOne({"snmp_location": snmpLocation});

        if (!matchedRecord) {
            return res.status(404).json({ message: "No PNP Template found for SNMP location" });
        }

        // Optionally extract only the matching template entry from array:
        // const matchingTemplate = matchedRecord.PNP_Template_DAY_N.find(
        //     (entry) => entry.snmp_location === snmpLocation
        // );

        return res.status(200).json({
            //   siteClaim,
            matchedPNPTemplate: matchedRecord || null,
        });
    } catch (err) {
        logger.error({ msg: `Error in getSiteClaimAndPnpTemplateBySourceUrl: ${err}`, error: err, status: false });
        return sendError(res, 500, 'Failed to fetch site claim and PNP template');
    }
};



export const pingDevice = async (req, res) => {
    try {
        
        let { device, dnacUrl,ip } = req.body;
        device = device?.split(" ")[0]; // Extract IP from device string
        if (!ip || !device || !dnacUrl) {
            logger.error({ msg: "Unable to get ip,device or dnac url ", status: false })
            console.log({ msg: "Unable to get ip,device or dnac url ", status: false })
            return res.send({ msg: "Unable to get ip,device or dnac url ", status: false })
        }
        let finalOutput = await dnacResponse(dnacUrl, device, ip)
        if (!finalOutput.status) {
            // if (Object.keys(finalOutput).length == 0 || !finalOutput.status) {
            logger.error(finalOutput)
            console.log(finalOutput)
            return res.send(finalOutput)
        }
        let pingStatus = finalOutput?.data?.includes("Success rate is 100 percent (5/5)")
        if (pingStatus) {
            let resultMsg = { msg: "Gateway reachable from the current management IP", status: true }
            console.log(resultMsg)
            logDnacResponse("onboarding.pingDeviceIfPart",resultMsg)
            return res.send(resultMsg)
        } else {
            let resultMsg = { msg: "Gateway unreachable from the current management IP. Please verify connectivity.", status: false }
            console.log(resultMsg)
            pingDevice("onboarding.pingDeviceelsePart",resultMsg)
            return res.send(resultMsg)
        }

    } catch (err) {
        let resultMsg = { msg: `Failed to pingDevice:${err}`, status: false }
        logger.error(resultMsg)
        return res.send({ msg: `Failed to pingDevice`, status: false })
    }

};

export const networkDevice = async (device) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "ise": 1, "_id": 0 }).toArray();
        if (setUpDetails.length == 0 || Object.keys(setUpDetails[0]?.ise) == 0) {
            return { msg: "Unable to get ISE credential", status: true }
        }

        const { iseURL, iseURLName, iseURLPassword } = setUpDetails[0]?.ise
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://${iseURL}/ers/config/networkdevice`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                Authorization:
                    "Basic " +
                    Buffer.from(
                        iseURLName + ":" + iseURLPassword
                    ).toString("base64"),
            },
            httpsAgent: httpsAgent
        };
        // await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await axios.request(config);
        if (Object.keys(response).length == 0 || Object.keys(response?.data).length == 0 || Object.keys(response?.data?.SearchResult).length == 0 || response?.data?.SearchResult?.resources?.length == 0) {
            return { data: [], msg: "Unable to get network device from ISE", status: false }
        }
        let networkDeviceOutput = response?.data?.SearchResult?.resources
        networkDeviceOutput = networkDeviceOutput.map(item => ({
            ...item,
            created: new Date(),
            updatedAt: new Date
        }));
        let matchIp = networkDeviceOutput.filter((items) => { return items.name == device })
        //  output.push({ ...item, ...response2?.data?.NetworkDevice, createdAt: new Date(), updatedAt: new Date() })
        // let findData = await await db_connect.collection('ms_iseinventory').find({}).toArray()
        // if (findData.length > 0) {
        //     let deleteNetworkDevice = await db_connect.collection('ms_iseinventory').deleteMany({});
        //     let saveNetworkDevice = await db_connect.collection('ms_iseinventory').insertMany(networkDeviceOutput);
        // } else {
        //     let saveNetworkDevice = await db_connect.collection('ms_iseinventory').insertMany(networkDeviceOutput);
        // }
        if (matchIp) {
            return { data: [], msg: `Device ${device} is avaliable in ISE`, status: true }
        } else {
            return { data: [], msg: `Device ${device} is not avaliable in ISE`, status: false }
        }

        // for (let item of networkDeviceOutput) {
        //     config["url"] = item.link.href;
        //     // let config2 = {
        //     //     method: 'get',
        //     //     maxBodyLength: Infinity,
        //     //     url: item.link.href,
        //     //     headers: {
        //     //         'Content-Type': 'application/json',
        //     //         'Accept': 'application/json',
        //     //         Authorization:
        //     //             "Basic " +
        //     //             Buffer.from(
        //     //                 iseURLName + ":" + iseURLPassword
        //     //             ).toString("base64"),
        //     //     },
        //     //     httpsAgent: httpsAgent
        //     // };
        //     const response2 = await axios.request(config);
        //     // const response2 = await axios.request(config2);
        //     if (Object.keys(response2).length == 0 || Object.keys(response2.data).length == 0 || Object.keys(response2.data.NetworkDevice).length == 0) {
        //         logger.error({ msg: `${item?.link?.href} not working.`, status: false })
        //         console.log({ msg: `${item?.link?.href} not working.`, status: false })
        //         output.push({ ...item, msg: `${item?.link?.href} not working.`, createdAt: new Date(), updatedAt: new Date() })
        //     } else {
        //         output.push({ ...item, ...response2?.data?.NetworkDevice, createdAt: new Date(), updatedAt: new Date() })
        //     }
        // }
    } catch (err) {
        let msgOutput = { fileId: "", msg: `Error in taskResponse:${err.message || err}`, status: false }
        logger.error({ msg: `Error in networkDevice: ${err}`, error: err, status: false });
        return msgOutput
    }
};

const generateInterfaceConfig = async(interfaceLevel) => {
    let interfaceConfig = "";

    interfaceLevel.forEach((item) => {
        const interfaces = item?.interface || [];
        const descRaw = item?.port_description || "";
        const desc = descRaw.toLowerCase();
        const accessVlan = item?.access_vlan || "X";
        const voiceVlan = item?.voice_vlan || "X";

        interfaces.forEach((intf) => {
            interfaceConfig += `interface ${intf}\n`;
            interfaceConfig += `description ${descRaw}\n`;

            if (desc.includes("user data & voice port")) {
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport voice vlan ${voiceVlan}
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else if (desc.includes("user data")) {
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport voice vlan ${voiceVlan}
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else if (desc.includes("stagging")) {
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else if (desc.includes("printer")) {
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else if (desc.includes("voice")) {
                interfaceConfig += `
switchport mode access
switchport voice vlan ${voiceVlan}
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else if (desc.includes("cctv")) {
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else if (desc.includes("act")) {
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else if (desc.includes("bms")) {
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else if (desc.includes("cms")) {
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            } else {
                // Default case
                interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
            }

            interfaceConfig += `\n`; // gap between interface blocks
        });
    });

    return interfaceConfig.trim();
};



export const configurationDetails = async (req, res) => {
    try {
        let data = req.body
        // const db_connect = dbo && dbo.getDb();
        if (!db_connect) {
            logger.error({ msg: "Unable to connect to database.", status: false })
            return res.send({ msg: "Unable to connect to database.", status: false })
        }
        if (!data || Object.keys(data).length == 0 || data.interfaceLevel.length == 0) {
            logger.error({ msg: "Unable to get data from user.", status: false })
            return res.send({ msg: "Unable to get data from user.", status: false })
        }
        const { interfaceLevel } = data;
        let interfaceConfig = ""
        const cliOutput = await run_show_command_on_device(data?.dnac, data?.device, 'show interfaces status');
        const stormValues = getStormControlValue(cliOutput);
        console.log(stormValues, "stormValues from cli output");
        logger.info({ msg: "stormValues from cli output", stormValues, status: true })
        
        const configOutput = generateInterfaceConfig(req.body.interfaceLevel,data?.device,data.dnacUrl);
        if (!configOutput) {
            logger.error({ msg: "Unable to make interface configuration", status: false })
            return res.json({ msg: "Unable to make interface configuration", status: false })
        }
        interfaceConfig = configOutput.slice(0, -1)
        let dnacData = {
            config: interfaceConfig,
            dnac: data?.dnacUrl,
            device: data?.device,
        }
        let excuteConfigInDnac = await execute_templates(dnacData)
        let msgs = {};
        if (excuteConfigInDnac == "SUCCESS") {
            msgs = { msg: "Device configured successfully.", status: true }
        } else {
            logger.error({ msg: "Unable to configured device.", status: false })
            msgs = { msg: "Unable to configured device.", status: false }
        }
        let details = { ...data, config: interfaceConfig, createdAt: new Date(), updatedAt: new Date() }
        let saveData = await db_connect.collection('ms_interfaceConfig').insertOne(details);
        return res.json(msgs)
        // check device exist in ISE or not
        // let iseNetworkDevice = await networkDevice(data?.device)
        // return res.send(iseNetworkDevice)
    } catch (err) {
        console.log(`Error in configuration:${err}`)
        logger.error({ msg: `Error in configurationDetails:${err}`, status: false })
        let msgError = { msg: `Error in configurationDetails:${err.message}`, status: false }
        return sendError(res, 500, 'Failed to process configuration details');
    }

};

export const validateDataFromDnac = async (dnacUrl, device) => {
    try {
        let commanCredential = await commonCredentials(device, dnacUrl)
        const { token } = commanCredential
        if (token == "") {
            logger.error({ msg: `Device is configured successfully but unable to get token in validData`, status: false })
            let msgError = { msg: `Device is configured successfully but unable to get token in validData`, status: false }
            return msgError
        }
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `${dnacUrl}/dna/intent/api/v1/network-device?managementIpAddress=${device}`,
            headers: {
                'x-auth-token': token
            },
            httpsAgent: httpsAgent
        };
        let result = await axios.request(config)
        if (result && result.status == 200) {
            // console.log("The device is successfully configured and accessible.")
            logger.error({ msg: `The device is successfully configured and accessible`, status: true })
            let msg = { msg: `The device is successfully configured and accessible`, status: true }
            return msg
        } else {
            console.log("The device is successfully configured but not accessible.", result)
            logger.error({ msg: `The device is successfully configured but not accessible:${result}`, status: false })
            let msg = { msg: `The device is successfully configured but not accessible`, status: false }
            return msg
        }

    } catch (err) {
        console.log("Error in validateDataFromDnac", err)
        logger.error({ msg: `Error in validateDataFromDnac:${err.message}`, status: false })
        let msgError = { msg: `Error in validate Data From Dnac`, status: false }
        return msgError
    }
};

function getShutdownInterfaces(interfaceLevel, deviceInterfaces) {
  // Step 1: Extract all frontend interfaces into a Set
  const frontendInterfaces = new Set();

  interfaceLevel.forEach(entry => {
    entry.interface.forEach(intf => {
      frontendInterfaces.add(intf);
    });
  });

  // Step 2: Extract portName values from deviceInterfaces
  const deviceInterfaceSet = new Set(
    deviceInterfaces.map(intf => intf.portName) // <-- Fixed here
  );

  // Step 3: Find interfaces that need to be shut down
  const interfacesToShutdown = [];
  deviceInterfaceSet.forEach(intf => {
    if (!frontendInterfaces.has(intf)) {
      interfacesToShutdown.push(intf);
    }
  });

  // Step 4: Generate shutdown commands
  const shutdownCommands = interfacesToShutdown.map(intf => {
    return `interface ${intf}\n shutdown`;
  });

  return shutdownCommands;
}



 const getDeviceInterfaces = async (dnacUrl, device) => {
    try {
        // const { dnacUrl, device } = req.body;

        let commanCredential = await commonCredentials(device, dnacUrl)
        const { token, cli_command_url, AUTH_API_URL, switchUUID, dnacCredentials } = commanCredential
        let interfaceDetails = await interfaces(switchUUID, dnacUrl, token)
        let data = JSON.parse(interfaceDetails)
        if (data && data.length == 0) {
            return 'Unable to get port from device';
        }
        let inter = []
        for (let item of data.response) {
            if (item.interfaceType == 'Physical' && (!item.description || item.description.trim() === '')) {
                inter.push({ portName: item.portName })
            }
        }
        return inter;
    } catch (err) {
        logger.error({ msg: 'Error in dnacDeviceInterfaces', error: err, status: false });
        return 'Failed to fetch device interfaces'
    }
};


export const tacacsAndRadiusConf = async (req, res) => {
    try {
        let data = req.body
        // const cliOutput = await run_show_command_on_device(data?.dnacUrl, data?.device, 'show interfaces status');
        // const stormValues = getStormControlValue(cliOutput);
        // console.log(stormValues, "stormValues from cli output");
        const deviceInterfaces = await getDeviceInterfaces(data?.dnacUrl, data?.device);
        const shutdownInterface = getShutdownInterfaces(req.body.interfaceLevel, deviceInterfaces);
        const shutdownConfig = shutdownInterface.join('\n'); // 🔁 Convert array to single string

        const configOutput = await generateInterfaceConfig(req.body.interfaceLevel);
        if (data && data?.registrationData.length == 0) {
            logger.error({ msg: `Unable to get data from user.`, status: false })
            let msgError = { msg: `Unable to get data from user.`, status: false }
            return sendError(res, 500, 'Failed to process configuration details');
        }
        if (data && data?.device == "") {
            logger.error({ msg: `Please select device.`, status: false })
            let msgError = { msg: `Please select device.`, status: false }
            return sendError(res, 500, 'Failed to process configuration details');
        }
        let radiusServerData = data?.registrationData.filter((item) => { return item.type === "radiusServer" })
        let tacacsServerData = data?.registrationData.filter((item) => { return item.type === "TACACS" })
        if (radiusServerData.length == 0 && tacacsServerData.length == 0) {
            logger.error({ msg: `Radius and TACACS server data is not available.`, status: false })
            let msgError = { msg: `Radius and TACACS server data is not available.`, status: false }
            return sendError(res, 500, 'Failed to process configuration details');
        };
        let radiusBlock = `aaa server radius dynamic-author`;
        let radiusServers = ``;
        let radiusGroup = `aaa group server radius HCL-ISE`;

        for (let i = 0; i < radiusServerData.length; i++) {
            const { radiusName, iseServerIP, key } = radiusServerData[i];
            radiusBlock += `\nclient ${iseServerIP} server-key 7 ${key}`;
            radiusServers += `\nradius server ${radiusName}\n address ipv4 ${iseServerIP} auth-port 1812 acct-port 1813\n key 7 ${key}`;
            radiusGroup += `\nserver name ${radiusName}`;
        }

        radiusBlock += `radius-server attribute 6 on-for-login-auth
radius-server attribute 8 include-in-access-req
radius-server attribute 25 access-request include
radius-server dead-criteria time 5 tries 2
radius-server deadtime 10`;

        let tacacsGroup = `aaa group server tacacs+ NetworkAdmins`;
        for (let i = 0; i < tacacsServerData.length; i++) {
            const { iseServerIP, key } = tacacsServerData[i];
            tacacsGroup += `\nserver-private ${iseServerIP} key 7 ${key}`;
        }

        // Default config matching the client’s format
        const defaultConfig = `aaa authentication login default group NetworkAdmins local
aaa authentication login console line
aaa authentication login vty1 group NetworkAdmins local
aaa authentication login console1 local
aaa authentication enable default group NetworkAdmins enable group NetworkAdmins
aaa authentication dot1x default group HCL-ISE
aaa authorization exec default group NetworkAdmins local if-authenticated
aaa authorization exec vty1 group NetworkAdmins local if-authenticated
aaa authorization exec console1 local if-authenticated
aaa authorization network default group HCL-ISE
aaa authorization commands 7 console1 local if-authenticated
aaa authorization commands 15 console1 local if-authenticated
aaa authorization config-commands
aaa authorization console
aaa accounting exec default start-stop group NetworkAdmins
aaa accounting system default start-stop group NetworkAdmins
aaa accounting dot1x default start-stop group HCL-ISE`;

        const sourceInterface = data?.mgmtVlanL3Interface;
        const ipInterfaceBlock = `ip tacacs source-interface ${sourceInterface}
ip radius source-interface ${sourceInterface}`;

        // Build the full config
        const config = `
aaa new-model
aaa session-id common
${defaultConfig}
${radiusBlock}
${radiusServers}
${radiusGroup}
${tacacsGroup}
${ipInterfaceBlock}
`;

        console.log("config2", config)
        logger.info({ msg: "Configuration created.",config });
        // let finalConfig = `${configOutput}\n${config}`;
        let finalConfig = `${configOutput}\n${shutdownConfig}\n${config}`;

        let Data = {
            config: finalConfig,
            dnac: data?.dnacUrl,
            device: data?.device
        }
        return res.json({ msg: "configured Created successfully.", status: true, Data })

    } catch (err) {
        console.log("Error in tacacsAndRadiusConf", err)
        logger.error({ msg: `Error in tacacsAndRadiusConf: ${err}`, status: false })
        let msgError = { msg: `Error in tacacsAndRadiusConf: ${err.message}`, status: false }
        return sendError(res, 500, 'Failed to process configuration details');
    }
};



/**
 * @desc Configure a device via DNAC and validate the result
 * @route POST /api/configure-device
 */
export const configureDevice = async (req, res) => {
    try {
        const { config, dnac, device } = req.body.commandData;

        if (!config || !dnac || !device) {
            return res.status(400).json({
                status: false,
                msg: "Missing required fields: config, dnac, or device."
            });
        }

        const dnacData = { config, dnac: dnac, device };
        const executeResult = await execute_templates(dnacData);

        if (executeResult === "SUCCESS") {
            const validateResponse = await validateDataFromDnac(dnac, device);
            logger?.info(validateResponse); // Optional logging
            return res.json(validateResponse);
        } else {
            return res.json({
                status: false,
                msg: "Unable to configure device."
            });
        }

    } catch (error) {
        logger.error({ msg: `DNAC Configuration Error: ${error}`, error: error, status: false });
        return res.status(500).json({
            status: false,
            msg: "Error configuring device via DNAC.",
            error: error.message
        });
    }
};


export const configureDeviceInISE = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "ise": 1, "_id": 0 }).toArray();
        if (setUpDetails.length == 0 || Object.keys(setUpDetails[0]?.ise) == 0) {
            return { msg: "Unable to get ISE credential", status: true }
        }

        const { iseURL, iseURLName, iseURLPassword } = setUpDetails[0]?.ise
        const iseHost = `https://${iseURL}/ers/config/networkdevice`;
        // const iseHost = `https://${iseURL}:9060`;
        // Base64 encode the username:password for Basic Auth
        // const auth = base64.encode(`${iseURLName}:${iseURLPassword}`);
        //*************body******************* */
        const deviceData = {
            "NetworkDevice": {
                "name": "Test",
                "description": "Testing",
                "authenticationSettings": {
                    "radiusSharedSecret": "aaaaa",
                    "enableKeyWrap": true,
                    "dtlsRequired": true,
                    "keyEncryptionKey": "1234567890123456",
                    "messageAuthenticatorCodeKey": "12345678901234567890",
                    "keyInputFormat": "ASCII"
                },
                "snmpsettings": {
                    "version": "ONE",
                    "roCommunity": "aaa",
                    "pollingInterval": 3600,
                    "linkTrapQuery": true,
                    "macTrapQuery": true,
                    "originatingPolicyServicesNode": "Auto"
                },
                "trustsecsettings": {
                    "deviceAuthenticationSettings": {
                        "sgaDeviceId": "networkDevice1",
                        "sgaDevicePassword": "aaaaa"
                    },
                    "sgaNotificationAndUpdates": {
                        "downlaodEnvironmentDataEveryXSeconds": 86400,
                        "downlaodPeerAuthorizationPolicyEveryXSeconds": 86400,
                        "reAuthenticationEveryXSeconds": 86400,
                        "downloadSGACLListsEveryXSeconds": 86400,
                        "otherSGADevicesToTrustThisDevice": false,
                        "sendConfigurationToDevice": false,
                        "sendConfigurationToDeviceUsing": "ENABLE_USING_COA",
                        "coaSourceHost": "IseNodeName"
                    },
                    "deviceConfigurationDeployment": {
                        "includeWhenDeployingSGTUpdates": true,
                        "enableModePassword": "aaaaa",
                        "execModePassword": "aaaaa",
                        "execModeUsername": "aaa"
                    },
                    "pushIdSupport": "false"
                },
                "tacacsSettings": {
                    "sharedSecret": "aaaaa",
                    "connectModeOptions": "ON_LEGACY"
                },
                "profileName": "Cisco",
                "coaPort": 1700,
                "dtlsDnsName": "ISE213.il.com",
                "NetworkDeviceIPList": [
                    {
                        "ipaddress": "10.1.122.2",
                        "mask": 32
                    }
                ],
                "NetworkDeviceGroupList": [
                    "Location#All Locations",
                    "Device Type#All Device Types"
                ]
            }
        };

        // const deviceData = {
        //     NetworkDevice: {
        //         name: "Test-01",
        //         description: "Testing",
        //         ipAddresses: [
        //             {
        //                 ipaddress: "10.122.1.2",
        //                 mask: 32
        //             }
        //         ],
        //         authenticationSettings: {
        //             radiusSharedSecret: "MySecret123",
        //             radiusServerDefined: false
        //         },
        //         snmpSettings: {
        //             version: "ONE",
        //             roCommunity: "public",
        //             retries: 2,
        //             timeout: 5,
        //             pollInterval: 1000
        //         },
        //         coaPort: 1700,
        //         // dtlsRequired: false
        //     }
        // };


        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: iseHost,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // 'ERS-Media-Type': 'network.device.1.0',
                Authorization:
                    "Basic " +
                    Buffer.from(
                        iseURLName + ":" + iseURLPassword
                    ).toString("base64"),
            },
            data: JSON.stringify(deviceData),
            // NetworkDevice: deviceData.NetworkDevice,
            httpsAgent: httpsAgent,
        };

        // await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await axios.request(config);
        console.log("response", response)

        // axios.post(`${iseHost}`, deviceData, {
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Accept': 'application/json',
        //         'ERS-Media-Type': 'network.device.1.0',
        //         'Authorization': `Basic ${auth}`
        //     },
        //     httpsAgent: httpsAgent
        // })
        //     .then(response => {
        //         console.log('Network device created successfully:', response.data);
        //     })
        //     .catch(error => {
        //         console.error('Error creating network device:', error.response?.data || error.message);
        //     });

    } catch (err) {
        console.log("error in configureDeviceInISE", err)
    }
}


function normalizeKeys(row) {
    const normalized = {};
    for (const key in row) {
        const newKey = key.toLowerCase().replace(/\s+/g, '_');
        normalized[newKey] = row[key];
    }
    return normalized;
}

// export const convertExcelToJSON = async (req, res) => {
//     try {
//         const db_connect = dbo && dbo.getDb();
//         const __dirname = path.resolve();
//         const filePath = path.join(__dirname, 'Assignment_Group.xlsx');
//         const workbook = xlsx.readFile(filePath);
//         const sheetNames = workbook.SheetNames;

//         let outputData = {};

//         for (let i = 0; i < sheetNames.length - 1; i++) {
//             const sheet = workbook.Sheets[sheetNames[0]];
//             let jsonData = xlsx.utils.sheet_to_json(sheet, { defval: null });

//             jsonData = jsonData.map(row => {
//                 row = normalizeKeys(row);
//                 return {
//                     ...row,
//                     mgmt_subnet: row['mgmt_subnet'] ?? '10.138.132.128/25',
//                     reserved_seed_ports: row['reserved_seed_ports'] ?? 'Need to Reserve Two ports one from primary and one from secondary'
//                 };
//             });

//             outputData[sheetNames[i]] = jsonData;
//         }

//         if (Object.keys(outputData).length !== 0) {
//             let savePNPData = await db_connect.collection('ms_pnp_data').insertOne(outputData);
//             console.log('Excel converted to JSON and saved to MongoDB!');
//             return res.status(200).json({ message: "Data inserted successfully" });
//         } else {
//             console.log("Unable to read data from Excel in PNP");
//             return res.status(400).json({ message: "No data found in Excel" });
//         }

//     } catch (err) {
//         console.log("Error in convertExcelToJSON:", err);
//         return res.status(500).json({ error: 'Internal Server Error' });
//     }
// };



export const pnpDatafromDB = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let getPNPData = await db_connect.collection('pe_devices_config').find({}).toArray();
        if (getPNPData.length == 0) {
            console.log("Unbale to get pnp data from db")
            logger.error({ msg: `"Unbale to get pnp data from db"`, status: fasle })
            let msg = { msg: `"Unbale to get pnp data from db"`, status: false }
            return sendError(res, 500, 'Failed to fetch PNP data from DB');
        }
        res.json({ data: {"Sheet1":getPNPData}, status: true })

    } catch (err) {
        logger.error({ msg: `Error in pnpDatafromDB:${err}`, status: false });
        let msg = { msg: `Error in pnpDatafromDB:${err.message}`, status: false };
        return sendError(res, 500, 'Failed to fetch PNP data from DB');;
    }
}



// export const convertExcelToJSON2 = async (req, res) => {
//     try {
//         const db_connect = dbo && dbo.getDb();
//         const __dirname = path.resolve();
//         const filePath = path.join(__dirname, 'PE_Devices_Day0 1.xlsx');

//         const workbook = xlsx.readFile(filePath);
//         const sheetNames = workbook.SheetNames;
        
//         let outputData = {};
        
//         for (let i = 0; i < sheetNames.length; i++) {
//             const sheet = workbook.Sheets[sheetNames[i]];
//             let jsonData = xlsx.utils.sheet_to_json(sheet, { defval: null });
            
//             jsonData = jsonData.map(row => {
//                 row = normalizeKeys2(row);
//                 return {
//                     ...row,
//                     // mgmt_subnet: row['mgmt_subnet'] ?? '10.138.132.128/25',
//                     // reserved_seed_ports: row['reserved_seed_ports'] ?? 'Need to Reserve Two ports one from primary and one from secondary'
//                 };
//             });
            
//             outputData[sheetNames[i]] = jsonData;
//         }
        
//         if (Object.keys(outputData).length !== 0) {
//             const result =  await db_connect.collection('ms_pnp_data').insertOne(outputData);
//             console.log('✅ Excel converted and single document inserted into MongoDB.');
//             return res.status(200).json({ success: true, message: "Data inserted as single document", insertedId: result.insertedId });
//         } else {
//             console.log("⚠️ No data found in Excel");
//             return res.status(400).json({ success: false, message: "No data found in Excel" });
//         }
        
//     } catch (err) {
//         console.error("❌ Error in convertExcelToJSON:", err);
//         return res.status(500).json({ success: false, message: 'Internal Server Error' });
//     }
// };

// export const insertExcelRowsAsDocuments = async (req, res) => {
//     try {
//         const db_connect = dbo && dbo.getDb();
//         const __dirname = path.resolve();
//         const filePath = path.join(__dirname, 'Day0_DayN_Template_Name_METADATA.xlsx');

//         const workbook = xlsx.readFile(filePath);
//         const sheetName = 'Template_ID'; // Specify the sheet name you want to process
//         // const sheetName = 'PNP_Template_DAY_N'

//         if (!workbook.SheetNames.includes(sheetName)) {
//             return res.status(400).json({ success: false, message: `'${sheetName}' sheet not found in Excel file.` });
//         }

//         const sheet = workbook.Sheets[sheetName];
//         let jsonData = xlsx.utils.sheet_to_json(sheet, { defval: null });

//         const documents = jsonData.map(row => ({
//             ...normalizeKeys2(row),
//             sheet_name: sheetName
//         }));

//         if (documents.length > 0) {
//             const result = await db_connect.collection('template_mapping').insertMany(documents);
//             // const result = await db_connect.collection('dayN_configs').insertMany(documents);

//             console.log(`✅ ${result.insertedCount} documents inserted from '${sheetName}' sheet.`);
//             return res.status(200).json({
//                 success: true,
//                 message: `${result.insertedCount} documents inserted from '${sheetName}'`,
//                 insertedCount: result.insertedCount
//             });
//         } else {
//             return res.status(400).json({ success: false, message: `No data found in '${sheetName}' sheet.` });
//         }

//     } catch (err) {
//         console.error("❌ Error inserting 'templateid' sheet:", err);
//         return res.status(500).json({ success: false, message: 'Internal Server Error' });
//     }

// };



function normalizeKeys2(row) {
    const normalized = {};
    Object.keys(row).forEach(key => {
        const cleanKey = key.trim().replace(/\s+/g, '_').toLowerCase();
        normalized[cleanKey] = row[key];
    });
    return normalized;
}


export const getRadiusConfiguration = async (req, res) => {
    try {
        const radiusConfig = [
            // "ARUBA WAP PORT",
            // "Cisco WAP",
            "user data & voice port",
            "user data port",
            "stagging area port",
            "printer port",
            "voice port",
            "cctv port",
            "act port",
            "bms port",
            "cms port"
        ];

        return res.status(200).json({
            success: true,
            configType: "Radius Configuration",
            ports: radiusConfig
        });

    } catch (error) {
        logger.error({ msg: 'Error in getRadiusConfiguration', error, status: false });
        return sendError(res, 500, 'Failed to fetch radius configuration');
    }
};



export const deployDefaultGateway = async (req, res) => {
  try {
    const { dnac, device, gateway_ip } = req.body;

    if (!dnac || !device || !gateway_ip) {
      return res.status(400).json({ msg: "Missing required fields", status: false });
    }

    const item = {
      dnac,
      device,
      config: 
        `ip default-gateway ${gateway_ip}`
    };
   const result ={ status: true, msg:"Default gateway IP configured successfully" }
    // const result = await execute_templates(item);

    if (typeof result === 'string' || result.status === true) {
      return res.status(200).json({ msg: "Default gateway IP configured successfully" , status: true });
    } else {
      return res.status(500).json({ msg: "Failed to configure default gateway", result,status: false });
    }

  } catch (error) {
    console.error("Controller error:", error.message || error);
    return sendError(res, 500, 'Failed to process request');
  }
};


export const getCommandOutput = async (req, res) => {
  try {
    const { dnac, device, gateway_ip } = req.body;

    if (!dnac || !device || !gateway_ip) {
      return res.status(400).json({ msg: "Missing required fields", status: false });
    }

    const item = {
      dnac,
      device,
      config: 
        `show interfaces status`
    };

    const result = await run_show_command_on_device(dnac,device, item.config);

    if (typeof result === 'string' || result.status === true) {
      return res.status(200).json({ msg: "Default gateway IP configured successfully" , status: true });
    } else {
      return res.status(500).json({ msg: "Failed to configure default gateway", result,status: false });
    }

  } catch (error) {
    console.error("Controller error:", error.message || error);
    return sendError(res, 500, 'Failed to process request');
  }
};

export const getPnpClaimedDevices = async (req, res) => {
     try {

        const db_connect = dbo && dbo.getDb();

        let claimedDevices = await db_connect
            .collection("siteclaimdata")
            .find({ })
            .toArray();

        if (claimedDevices.length === 0) {
            return res.json({
                msg: "No claimed devices found.",
                status: true,
                data: []
            });
        }

        return res.json({
            msg: "Claimed devices fetched successfully.",
            status: true,
            data: claimedDevices
        });
    } catch (err) {
        const errorMsg = { msg: `Error in getClaimedDevices: ${err}`, status: false };
        logger.error(errorMsg);
        console.log(errorMsg);
        return sendError(res, 500, 'Failed to fetch claimed devices');
    }
};


export const getDeviceStatus = async (req, res) => {

    try {

        const { serialNumber, dnacUrl,id } = req.query;
        const credentialsData = await commonCredentials('', dnacUrl);

        if (!credentialsData?.token) {
            return res.status(400).json({ msg: "Failed to fetch token from DNAC", status: false });
        }
        const response = await axios.get(
            `${dnacUrl}/dna/intent/api/v1/onboarding/pnp-device?serialNumber=${serialNumber}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Auth-Token": credentialsData?.token,
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false }) // If self-signed
            }
        );

        const device = response.data[0];

        if (!device) {
            return res.status(404).json({
                message: "Device not found for provided serial number",
                serialNumber,
            });
        }
        const db_connect = dbo && dbo.getDb();
        let update = await db_connect.collection("siteclaimdata").updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    state: device.deviceInfo.state,
                    claimError: device.deviceInfo.errorDetails?.details || null,
                },
            }
        );


        return res.json({
            serialNumber: device.deviceInfo.serialNumber,
            deviceName: device.deviceInfo.hostname,
            state: device.deviceInfo.state,
            workflowState: device.workflow?.state,
            errorMessage: device.deviceInfo.errorDetails?.details || null,
            dayZeroErrorMessage: device.dayZeroConfigPreview?.errorMessage || null
        });

    } catch (error) {
        console.error("Error fetching PnP device status:", error.message);
        return res.status(500).json({
            message: "Failed to retrieve device status",
            error: error.message,
        });
    }
};



export const getDeviceBySerial = async (req, res) => {
    try {
        const { serialNumber, dnacUrl } = req.query;

        if (!serialNumber) {
            return sendError(res, 400, 'Serial number is required');
        }
        const db_connect = dbo && dbo.getDb();
        const query = { serialNumber };
        let commanCredential = await commonCredentials('', dnacUrl)
        const { token } = commanCredential;
        if (!token) {
            return sendError(res, 400, 'Failed to fetch token from DNAC');
        }
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        const response = await axios.get(`${dnacUrl}/dna/intent/api/v1/network-device?serialNumber=${serialNumber}`, {
            headers: {
                "X-Auth-Token": token
            },
            httpsAgent: httpsAgent
        });
        const device = response.data.response[0] || [];
        logger.info(device, "Device details fetched from DNAC");
        // const dbObject = {
        //     host_name: device.hostname,
        //     family: device.family,
        //     device_type: device.type,
        //     software_type: device.softwareType,
        //     managementIpAddress: device.managementIpAddress,
        //     mac_address: device.macAddress,
        //     software_version: device.softwareVersion,
        //     role: device.role,
        //     device_id: device.id,
        //     device_model: device.platformId ? [device.platformId] : [],
        //     device_series: device.series,
        //     serial_number: device.serialNumber,
        //     site_id: '',
        //     ssh_username: '',
        //     ssh_password: '',
        //     uptime: device.upTime,
        //     created_date: device.lastUpdated || new Date().toISOString(),
        //     source_url: device.sourceUrl || "DNAC",
        //     source: 'DNAC',
        //     reachabilityStatus: device.reachabilityStatus,
        //     vendor: 'Cisco',
        //     audit_device: 'false',
        //     is_processing: 'DNAC',
        //     is_excution_type: 'DNAC',
        // };
       
        // await db_connect.collection('ms_device').updateOne(
        //     {
        //         serial_number: dbObject.serial_number,
        //         managementIpAddress: dbObject.managementIpAddress
        //     },
        //     { $set: dbObject },
        //     { upsert: true }
        // );


        const platformId = device.platformId ? device.platformId.trim() : null;
        logger.info("Platform ID from DNAC is :", platformId);

        if (platformId) {
            const deviceDetails = {
                hostname: device.hostname,
                ip: device.managementIpAddress,
            };

            const matchingTemplates = await db_connect.collection('ms_compliance_templates').find({
                device_series: { $in: [platformId] },
                template_name: { $regex: /testing/i },
                is_mandatory: "true" 
            }).toArray();

            logger.info("Matching templates found:", matchingTemplates);
            const output = matchingTemplates.map((template) => ({
                ...template,
                ...deviceDetails
            }));

            logger.info("********** Matched Compliance Templates ******************** :", matchingTemplates);
            logger.info("********** Matched Compliance Templates Output ******************** :", output);
            return res.status(200).json({
                message: "Device found and compliance templates matched",
                device: output,
                status: true
            });
        } else {
            console.log("No platformId found for this device — skipping compliance match.");
            // logger.info("No platformId found for this device — skipping compliance match.");
        }
    } catch (error) {
        console.error("Error fetching PnP device by serial number:", error.message);
        logger.error({ msg: "Error fetching PnP device by serial number", error: error.message, status: false });
        return res.status(500).json({
            message: "Failed to retrieve device by serial number",
            error: error.message,
        });
    }
};

export const getAllDevices = async (req, res) => {
  try {
    const db_connect = dbo && dbo.getDb();
    const devices = await db_connect.collection("pe_devices_config").find({}).toArray();
    res.status(200).json({devices, message: 'Devices fetched successfully', status: true});
  } catch (error) {
    logger.error({ msg: 'Failed to fetch devices', error, status: false });
    return sendError(res, 500, 'Failed to fetch devices');
  }
};

export const updateDeviceById = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
        const db_connect = dbo && dbo.getDb();
    const result = await db_connect.collection("pe_devices_config").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return sendError(res, 404, 'Device not found');
    }

    res.status(200).json({ message: 'Device updated successfully', status: true });
  } catch (error) {
    logger.error({ msg: 'Failed to update device', error, status: false });
    return sendError(res, 500, 'Failed to update device');
  }
};

export const deleteDeviceById = async (req, res) => {
  const { id } = req.params;

  try {
        const db_connect = dbo && dbo.getDb();
    const result = await db_connect.collection("pe_devices_config").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return sendError(res, 404, 'Device not found');
    }

    res.status(200).json({ message: 'Device deleted successfully', status: true });
  } catch (error) {
    logger.error({ msg: 'Failed to delete device', error, status: false });
    return sendError(res, 500, 'Failed to delete device');
  }
};


export const getAllDayNConfigs = async (req, res) => {
  try {
        const db_connect = dbo && dbo.getDb();
    const configs = await db_connect.collection("dayN_configs").find({}).toArray();
    res.status(200).json(configs);
  } catch (error) {
    logger.error({ msg: 'Failed to fetch DayN configs', error, status: false });
    return sendError(res, 500, 'Failed to fetch DayN configs');
  }
};

export const updateDayNConfigById = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
        const db_connect = dbo && dbo.getDb();
    const result = await db_connect.collection("dayN_configs").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return sendError(res, 404, 'Config not found');
    }

    res.status(200).json({ message: 'Config updated successfully', status: true });
  } catch (error) {
    logger.error({ msg: 'Failed to update config', error, status: false });
    return sendError(res, 500, 'Failed to update DayN config');
  }
};

export const deleteDayNConfigById = async (req, res) => {
  const { id } = req.params;

  try {
        const db_connect = dbo && dbo.getDb();
    const result = await db_connect.collection("dayN_configs").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return sendError(res, 404, 'Config not found');
    }

    res.status(200).json({ message: 'Config deleted successfully', status: true });
  } catch (error) {
    logger.error({ msg: 'Failed to delete config', error, status: false });
    return sendError(res, 500, 'Failed to delete DayN config');
  }
};


function matchPidWithImageUdi(pnpPid, getImageIDResponse) {
    logger.info("matchPidWithImageUdi", pnpPid, getImageIDResponse.response)
  const matches = [];

  const targetPid = (pnpPid || '').toUpperCase();

  for (const image of getImageIDResponse.response) {
    const rawUdi = image?.extendedAttributes?.udi;

    if (!rawUdi) continue;

    const decodedUdi = decodeURIComponent(rawUdi); // e.g. "PID: C9300-24P VID: V02, SN: ..."
    logger.info("Decoded PID:", decodedUdi, "targetPid:", targetPid);

    const match = decodedUdi.match(/PID:\s*([^\s]+)/);
    const udiPid = match?.[1]?.toUpperCase();
    logger.info(udiPid, targetPid,"matchPidWithImageUdi udiPid,targetPid ");
    

    if (udiPid === targetPid) {
        logger.info(`✅ Match found for PID: ${udiPid}`)
      matches.push({
        imageUuid: image.imageUuid,
        family: image.family,
        displayVersion: image.displayVersion,
        imageName: image.imageName,
        pid: udiPid,
      });
    }

    // logger.info(`✅ No Match found for PID: ${udiPid}`)
  }

  return matches;
}



export const getGoldenImage = async (req, res) => {
    try {
         const {dnacUrl, pid} = req.query;
        const goldenImage = await getImageID(dnacUrl);
        logger.info("Golden Image Response from DNAC:", goldenImage);
        if (!goldenImage || goldenImage.length === 0) {
            logger.error({ msg: 'No golden image found in DNAC', status: false });
            return sendError(res, 404, 'No golden image found in DNAC');
        }
        const output = matchPidWithImageUdi(pid, goldenImage);
        // const output =[ {
        // imageUuid: "1234-5678-9012-3456",
        // family: "image.family",
        // displayVersion: "17.02.10",
        // imageName: "image.imageName",
        // pid: "udiPid",
        // }]
        
        
        return res.status(200).json({ data: output, status: true });
    } catch (error) {
        logger.error({ msg: `Error fetching golden image: ${error}`, status: false });
        return sendError(res, 500, 'Failed to fetch golden image');
    }
}



export const configureVtpmode = async (req, res) => {
    try {
        const { dnac, device, vtpmode } = req.body;
        
        if (!dnac || !device || !vtpmode) {
            return res.status(400).json({ msg: "Missing required fields", status: false });
        }

        const item = {
            dnac,
            device,
            config: `vtp mode ${vtpmode}`
        };

        const result = await execute_templates(item);

        if (typeof result === 'string' || result.status === true) {
            return res.status(200).json({ msg: "VTP mode configured successfully", status: true });
        } else {
            return res.status(500).json({ msg: "Failed to configure VTP mode", result, status: false });
        }

    } catch (error) {
        console.error("Controller error:", error.message || error);
        logger.error({ msg: `Error in configureVtpmode: ${error}`, status: false });
        return sendError(res, 500, 'Failed to process request');
    }
}   



export const updateMgmtIpAddress = async (req, res) => {
    try {
        const { dnac, existMgmtIp, newMgmtIp } = req.body;

        if (!dnac || !existMgmtIp || !newMgmtIp) {
            return res.status(400).json({ msg: "Missing required fields", status: false });
        }

        const payload = {
            dnac,
            device: "",
            config: {
                updateMgmtIPaddressList: [
                    {
                        existMgmtIpAddress: existMgmtIp,
                        newMgmtIpAddress: newMgmtIp
                    }
                ]
            }
        };

        const result = await callMgmtIpUpdateApi(payload);

        if (result?.status === true) {
            return res.status(200).json({ msg: "Management IP updated successfully", status: true });
        } else {
            return res.status(500).json({ msg: "Failed to update Management IP", result, status: false });
        }

    } catch (error) {
        console.error("Controller error:", error.message || error);
        logger.error({ msg: `Error in updateMgmtIpAddress: ${error}`, status: false });
        return sendError(res, 500, 'Failed to process request');
    }
}


export const syncDevicesWithDnac = async (req, res) => {
    try {
        const { dnac, deviceIds } = req.body;

        if (!dnac || !Array.isArray(deviceIds) || deviceIds.length === 0) {
            return res.status(400).json({ msg: "Missing required fields: dnac and deviceIds", status: false });
        }

        const payload = {
            dnac,
            deviceIds
        };

        const result = await callSyncDevicesApi(payload);

        if (result?.status === true) {
            return res.status(200).json({ msg: "Device sync initiated successfully", status: true, data: result.data });
        } else {
            return res.status(500).json({ msg: "Failed to sync devices", result, status: false });
        }

    } catch (error) {
        console.error("Controller error:", error.message || error);
        logger.error({ msg: `Error in syncDevicesWithDnac: ${error}`, status: false });
        return sendError(res, 500, 'Failed to process request');
    }
};

export const updateDeviceMgmtAddress = async (req, res) => {
    try {
        const { dnac, newIP,existMgmtIp } = req.body;

        if (!dnac || !newIP) {
            return res.status(400).json({ msg: "Missing required fields", status: false });
        }

        const result = await updateMgmtAddressHelper(dnac, newIP,existMgmtIp);

        if (result.status === true) {
            return res.status(200).json({ msg: "Management IP updated successfully", taskId: result.taskId, status: true });
        } else {
            return res.status(500).json({ msg: result.msg || "Failed to update Management IP", status: false });
        }

    } catch (error) {
        logger.error({ msg: `Error in updateDeviceMgmtAddress: ${error.message}`, status: false });
        return sendError(res, 500, 'Internal server error');
    }
};

