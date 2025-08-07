import { createCipheriv } from 'crypto';
import ping from "ping";
import logger from '../../logger.js';
import https from "https"
import axios from "axios";

export const decript = (data) => {
    try {
        const decoded = Buffer.from(data, 'base64').toString();
        // console.log("sdfghj",decoded)
        return decoded;
    } catch (error) {
        logger.error({ msg: "Error in decript", error: error, status: false });
    }
}

export function encryptAES(text, key) {
    const cipher = createCipheriv('aes-256-ecb', Buffer.from(key), null);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
};

function getDeviceFamilyFromUDI(udi) {
  if (!udi || typeof udi !== 'string') return 'Unknown';

  // Step 1: Decode URL-encoded string
  const decodedUdi = decodeURIComponent(udi);

  // Step 2: Extract PID (e.g., "PID: C9300-24UX")
  const pidMatch = decodedUdi.match(/PID:\s*([^\s]+)/);
  if (!pidMatch || pidMatch.length < 2) {
    return {
      pid: decodedUdi,
      familyCode: 'UNKNOWN',
      friendlyName: 'Unknown Device Family',
    };
  }

  const pid = pidMatch[1].toUpperCase();

  // Step 3: Match PID to family
  const pidFamilyMap = [
    {
      pattern: /^C9300/,
      familyCode: 'CAT9K',
      friendlyName: 'Catalyst 9300 Series',
    },
    {
      pattern: /^C9400/,
      familyCode: 'CAT9K',
      friendlyName: 'Catalyst 9400 Series',
    },
    {
      pattern: /^C9500/,
      familyCode: 'CAT9K',
      friendlyName: 'Catalyst 9500 Series',
    },
    {
      pattern: /^ISR4/,
      familyCode: 'ISR4000',
      friendlyName: 'ISR 4000 Series',
    },
    {
      pattern: /^ASR1/,
      familyCode: 'ASR1000',
      friendlyName: 'ASR 1000 Series',
    },
    {
      pattern: /^ASA55/,
      familyCode: 'ASA5500X',
      friendlyName: 'ASA 5500-X Firewall Series',
    },
    {
      pattern: /^N9K/,
      familyCode: 'NEXUS9000',
      friendlyName: 'Nexus 9000 Series',
    },
    {
      pattern: /^WS-C/,
      familyCode: 'CAT2K/3K',
      friendlyName: 'Catalyst Classic Series (2K/3K)',
    },
    {
      pattern: /^MX/,
      familyCode: 'MERAKI_MX',
      friendlyName: 'Meraki MX Security Appliances',
    },
  ];

  for (const entry of pidFamilyMap) {
    if (entry.pattern.test(pid)) {
      return {
        pid,
        familyCode: entry.familyCode,
        friendlyName: entry.friendlyName,
      };
    }
  }

  return {
    pid,
    familyCode: 'UNKNOWN',
    friendlyName: 'Unknown Device Family',
  };
}








