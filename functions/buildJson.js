const numberToString = {
  0: "A",
  1: "B",
  2: "C",
  3: "D",
  4: "E",
  5: "F",
  6: "G",
  7: "H",
  8: "I",
  9: "J",
  10: "K",
  11: "L",
  12: "M",
  13: "N",
};

module.exports.insertTimeJson = (
  flexMessageTemplate,
  hour,
  dateOrder,
  alphabeticalOrder,
  i,
  isReserved,
  date
) => {
  const format = {
    type: "button",
    style: "link",
    height: "sm",
    action: {
      type: "message",
      label: `
      ${i === 1 ? hour++ : hour}:${i === 0 ? "00" : "30"} ~ ${
        i === 1 ? hour++ : hour
      }:${i === 0 ? "30" : "00"}`,
      text: `4/${date}/${numberToString[alphabeticalOrder]}`,
    },
    offsetStart: "-30px",
    margin: "5px",
  };

  if (!isReserved) {
    flexMessageTemplate.contents.contents[dateOrder].body.contents.push(format);
  }

  return flexMessageTemplate;
};
