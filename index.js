require("dotenv").config();
// index.js
const line = require("@line/bot-sdk");
const express = require("express");
const action = require("./action");
const schedule = require("node-schedule");
const initialFlexMessageTemplate = require("./template/flexMsgTemplate.json");
const queryDeleteFlexMessageTemplate = require("./template/queryDelete.json");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

const app = express();

let lock = false;

const eventQueue = [];
const job = schedule.scheduleJob("* * * * * *", async function () {
  if (eventQueue.length > 0 && !lock) {
    //init json
    let flexMessageTemplate = JSON.parse(
      JSON.stringify(initialFlexMessageTemplate)
    );

    lock = true;
    const event = eventQueue.shift();
    await handleEvent(event, flexMessageTemplate);
    lock = false;
  }
});

app.post("/webhook", line.middleware(config), (req, res) => {
  eventQueue.push(req.body.events[0]);
  res.send(200);
});

// event handler
async function handleEvent(event, flexMessageTemplate) {
  // console.log(event.message.id);
  const userID = event.source.userId;

  if (event.type !== "message" || event.message.type !== "text") return;

  let reply;
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
      let reply = await action.reserve(flexMessageTemplate);
      await client.replyMessage(event.replyToken, reply);
    }
    //
    else if (request === "查詢/刪除預約") {
      await client.replyMessage(
        event.replyToken,
        queryDeleteFlexMessageTemplate
      );
    }
    //query
    else if (request === "查詢") {
      let reply = await action.query(userID);
      await client.replyMessage(event.replyToken, reply);
    }
    //delete
    else if (request === "刪除") {
      await client.pushMessage(event.source.userId, {
        type: "text",
        text: "正在刪除您的時段，請稍候",
      });
      let reply = await action.delete(userID);
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "您的預約已刪除",
      });
    }
    //check is reserved and write in database
    else if (dateRegex.test(request)) {
      reply = await action.isReserved(request, userID);
      await client.replyMessage(event.replyToken, reply);
    }
    //write email in database
    else if (emailRegex.test(request)) {
      await client.pushMessage(event.source.userId, {
        type: "text",
        text: "正在預約您的時段，請稍候",
      });
      reply = await action.writeEmail(request, userID);
      await client.replyMessage(event.replyToken, reply);
    }
    //default
    else {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "很抱歉！\n本帳號無法個別回覆用戶的訊息，或是確認您的訊息格式是否正確",
        wrap: true,
      });
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

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
