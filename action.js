const buildJson = require("./functions/buildJson");
const admin = require("firebase-admin");
let flexMessageTemplate = require("./template/flexMsgTemplate.json");
admin.initializeApp({
  credential: admin.credential.cert(require("./admin.json")),
});

//concurrent problem
let dateOrder = 0;
module.exports.reserve = async () => {
  const db = admin.firestore();
  // console.log(dataIndex);
  for (let month = 4; month <= 5; month++) {
    const beginDate = month === 4 ? 10 : 12;
    const endDate = month === 4 ? 14 : 15;

    for (let date = beginDate; date <= endDate; date++) {
      await db
        .collection("Booking-Time")
        .doc(month.toString())
        .collection(date.toString())
        .get()
        .then((querySnapshot) => {
          console.log(`${month}/${date}`);

          let alphabeticalOrder = 0;
          querySnapshot.forEach((doc) => {
            const periodArr = doc.data().period;
            for (let i = 0; i < periodArr.length; i++) {
              let isReserved = periodArr[i];
              flexMessageTemplate = buildJson.insertTimeJson(
                flexMessageTemplate,
                doc.id,
                dateOrder,
                alphabeticalOrder,
                i,
                isReserved
              );
              alphabeticalOrder++;
            }
          });
          console.log("------------------");
        });
      dateOrder++;
    }
  }
  dateOrder = 0;
  return flexMessageTemplate;
};
