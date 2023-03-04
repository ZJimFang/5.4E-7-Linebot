require("dotenv").config();
// index.js
const line = require("@line/bot-sdk");
const express = require("express");
const action = require("./action");
const schedule = require("node-schedule");
const initialFlexMessageTemplate = require("./template/flexMsgTemplate.json");

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

  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  let reply;
  let request = event.message.text;

  const dateRegex = /^[45]\/1[0-5]\/[A-N]$/;
  const emailRegex =
    /^\w+((-\w+)|(\.\w+))*\@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z]+$/;

  //output reserve schedule
  if (request === "預約時間") {
    //請稍候
    await client.pushMessage(event.source.userId, {
      type: "text",
      text: "請稍候",
    });
    //to db query data to build json file
    try {
      let reply = await action.reserve(flexMessageTemplate);
      await client.replyMessage(event.replyToken, reply);
    } catch (err) {
      console.error(err);
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "發生錯誤，請稍後再試。",
      });
    }
  }
  //query serve
  else if (request === "查詢/刪除預約") {
  }
  //check is reserved and write in database
  else if (dateRegex.test(request)) {
    reply = await action.isReserved(request, userID);
    await client.replyMessage(event.replyToken, reply);
  }
  //write email in database
  else if (emailRegex.test(request)) {
    reply = await action.writeEmail(request, userID);
    await client.replyMessage(event.replyToken, reply);
  }
  console.log("finish");
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
