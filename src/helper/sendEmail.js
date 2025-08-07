// const nodemailer = require('nodemailer');
import nodemailer from "nodemailer"
// const configurations = require('../models/configurations');
// const decryptPassword = require('../models/configurations');
import dbo from "../db/conn.js";
const sendEmail = async ({ to, subject, data }) => {
    const db_connect = dbo && dbo.getDb();
    let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "email": 1, "_id": 0 }).toArray();
//   const credential = await configurations.findOne({category:'email'});
  const decryptedPassword = credential.decryptPassword();
  
console.log(credential,"______________________________",decryptedPassword);

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: credential.email,
      pass: decryptedPassword,
    }
  });

  try {
    const info = await transporter.sendMail({
      from: credential.email,
      to,
      subject,
      html: data.html
    });

    logger.info({ msg: 'Message sent', messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error({ msg: 'Error sending email', error: error, status: false });
    return { success: false, message: "Failed to send email." };
  }
};

module.exports = sendEmail;
