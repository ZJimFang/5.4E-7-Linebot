require("dotenv").config();
// index.js
const line = require("@line/bot-sdk");
const express = require("express");
const action = require("./action");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

const app = express();

app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      res.status(200).end();
    });
});

// event handler
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  let reply;
  switch (event.message.text) {
    case "預約時間":
      const reserveReply = await action.reserve();
      reply = reserveReply;
      break;
    case "查詢預約":
      break;
    case "刪除預約":
      break;

    default:
      break;
  }

  if (reply) {
    await client.replyMessage(event.replyToken, reply);
  }
}
// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
