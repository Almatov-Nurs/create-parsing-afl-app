const prompt = require('prompt-sync')();
const getContent = require("./helpers/puppeteer");


(async function() {
  try {
    const tour = prompt('Введите тур: ');
    const division = prompt('Введите дивизион(формат - "премьер дивизион"): ');
    const tourType = prompt('Какой тур (осенний, весенний, зимний или вообще летний): ');

    await getContent(tour, division, tourType);
  } catch (e) {
    console.log(e);
  }
})()