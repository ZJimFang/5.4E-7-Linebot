require("dotenv").config();
const line = require("@line/bot-sdk");
const express = require("express");
const action = require("./action");
const schedule = require("node-schedule");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });

const initialFlexMessageTemplate = require("./template/flexMsgTemplate.json");
const queryDeleteFlexMessageTemplate = require("./template/queryDelete.json");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

admin.initializeApp({
  credential: admin.credential.cert(require("./admin.json")),
});
const db = admin.firestore();

const client = new line.Client(config);

const app = express();

let lock = false;

const eventQueue = [];
const requestTable = [];

app.get("/home", (req, res) => {
  return res.status(200).json({
    title: "Express Testing",
    message: "The app is working properly!",
  });
});
//webhook
app.post("/webhook", line.middleware(config), (req, res) => {
  if (req.body.events[0] !== undefined) {
    let userId = req.body.events[0].source.userId;
    if (
      userId ===
      requestTable.find(
        (element) => element == req.body.events[0].source.userId
      )
    ) {
      client.pushMessage(req.body.events[0].source.userId, {
        type: "text",
        text: "請勿短時間內發出大量請求，否則將被禁止",
      });
      return;
    }

    // requestTable.push(userId);
    // eventQueue.push(req.body.events[0]);
    let flexMessageTemplate = JSON.parse(
      JSON.stringify(initialFlexMessageTemplate)
    );

    handleEvent(event, flexMessageTemplate);
  }

  res.send(200);
});

//scheduler
// const eventJob = schedule.scheduleJob("* * * * * *", async function () {
//   if (eventQueue.length > 0 && !lock) {
//     //init json
//     let flexMessageTemplate = JSON.parse(
//       JSON.stringify(initialFlexMessageTemplate)
//     );

//     lock = true;
//     const event = eventQueue.shift();
//     await handleEvent(event, flexMessageTemplate);
//     await requestTable.shift();
//     lock = false;
//   }
// });

//scheduler setting
const rule = new schedule.RecurrenceRule();
rule.minute = [0, 30];

const remindJob = schedule.scheduleJob(rule, async function () {
  const date = new Date();
  const month = (date.getMonth() + 1).toString();
  const day = date.getDate().toString();
  const hour = date.getHours().toString();
  const period = date.getMinutes() <= 30 ? 0 : 1;

  await db
    .collection("Booking-Time")
    .doc(month)
    .collection(day)
    .doc(hour)
    .get()
    .then(async (doc) => {
      if (doc.exists) {
        const hasReserved = doc.data().period[period];
        if (hasReserved) {
          const userID = doc.data().user[period];
          await client.pushMessage(userID, {
            type: "text",
            text: "您的預約即將開始，請提前至5.4E+7展場報到！",
          });
        }
      }
    });
});

// event handler
async function handleEvent(event, flexMessageTemplate) {
  const userID = event.source.userId;

  if (event.type !== "message" || event.message.type !== "text") return;

  let request = event.message.text;
  const dateRegex = /^[45]\/1[0-5]\/[A-N]$/;
  const emailRegex =
    /^\w+((-\w+)|(\.\w+))*\@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z]+$/;
  try {
    //output reserve schedule
    if (request === "預約時間") {
      //請稍候
      await client.pushMessage(event.source.userId, {
        type: "text",
        text: "請稍候",
      });
      //to db query data to build json file
      const reply = await action.reserve(db, flexMessageTemplate);
      await client.replyMessage(event.replyToken, reply);
    } else if (request === "查詢/刪除預約") {
      await client.replyMessage(
        event.replyToken,
        queryDeleteFlexMessageTemplate
      );
    }
    //query
    else if (request === "查詢") {
      const reply = await action.query(db, userID);
      await client.replyMessage(event.replyToken, reply);
    }
    //delete
    else if (request === "刪除") {
      await client.pushMessage(event.source.userId, {
        type: "text",
        text: "正在刪除您的時段，請稍候",
      });
      const reply = await action.delete(db, userID);
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "您的預約已刪除",
      });
    } else if (request === "文字雲") {
      const profile = await client.getProfile(userID);
      const reply = await action.changeToWordCloudStatus(
        db,
        userID,
        profile.displayName,
        profile.pictureUrl
      );
      await client.replyMessage(event.replyToken, reply);
    }
    //check is reserved and write in database
    else if (dateRegex.test(request)) {
      const reply = await action.isReserved(db, request, userID);
      await client.replyMessage(event.replyToken, reply);
    }
    //write email in database
    else if (emailRegex.test(request)) {
      await client.pushMessage(event.source.userId, {
        type: "text",
        text: "正在預約您的時段，請稍候",
      });
      const reply = await action.writeEmail(db, request, userID);
      await client.replyMessage(event.replyToken, reply);
    }
    //default
    else {
      const status = await checkIsInWordCloud(userID);
      if (status) {
        await client.pushMessage(event.source.userId, {
          type: "text",
          text: "正在傳送至文字雲，請稍候",
        });
        const reply = await action.writeInWordCloud(db, request, userID);
        await client.replyMessage(event.replyToken, reply);
      } else {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "很抱歉！\n本帳號無法個別回覆用戶的訊息，或是確認您的訊息格式是否正確",
          wrap: true,
        });
      }
    }
  } catch (error) {
    console.log(error);
    await client.pushMessage(event.source.userId, {
      type: "text",
      text: "發生錯誤，請稍候再試。",
    });
  }
  console.log("finish");
}

//check user status
async function checkIsInWordCloud(userID) {
  const status = await db
    .collection("WordCloud")
    .doc(userID)
    .get()
    .then((doc) => {
      return doc.data().status;
    });

  return status;
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
