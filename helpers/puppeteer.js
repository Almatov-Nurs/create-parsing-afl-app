const puppeteer = require("puppeteer");

const BASE_URL = 'https://api.football.kg/admin/match/match/';
const ADMIN_URL = 'https://afl.geekstudio.kg/admin/championship/match/';

async function getPlayers(page, selector, parent) {
  if (page.$(parent)) {
    const data = await page.$$eval(selector, (elements) => {
      return Array.from(elements, element => {
        const current = element.getAttribute('title');
        return current.split(' ').slice(0, current.split(' ').length / 2).join(' ');
      })
    });
    return data;
  }

  return [];
};

async function selectYourChoice(page, selectorBar, reg, versus = '') {
  await page.waitForSelector(selectorBar);
  const options = await page.evaluate((selector) => {
    const elements = Array.from(document.querySelectorAll(selector));
    return elements.map(element => element.textContent.trim());
  }, selectorBar);
  
  const elements = await page.$$(selectorBar);
  const regexp = new RegExp(reg, 'i');
  const current = options.map((i, idx) => regexp.test(i) && elements[idx]).find(i => i !== false);

  if (current) {
    await current.click();
  } else {
    if (versus) console.log('\n' + versus + ':');
    console.log('   Не найден:', reg);
    await page.click('body div');
  }
};

async function getPageContent(browser, array) {
  const result = [];
  // inputs
  const addressSelector = 'input[name="address"]';
  const dateSelector = 'input[name="date_0"]';
  const datetimeSelector = 'input[name="date_1"]';
  const firstTeam = '#select2-id_team_one-container';
  const secondTeam = '#select2-id_team_two-container';
  const goal = '.field-player .select2-selection__rendered';
  const assist = '.dynamic-assists .select2-selection__rendered';
  const fall = '#select2-id_falls-0-player-container';
  const fallStatus = '#select2-id_falls-0-fall-container';
  const best_player = '.dynamic-mvps .select2-selection__rendered';
  // links
  const teamLink = '.nav-tabs .nav-item .nav-link';

  for (let i = 0; i < array.length; i++) {
    const current = {};
    const link = await array[ i ].$eval('th a', (element) => {
      return element.href;
    });
    const page = await browser.newPage();
    await page.goto(link);

    await page.waitForSelector(addressSelector);
    const address = await page.$eval(addressSelector, element => element.value);
    await page.waitForSelector(dateSelector);
    const date_ = await page.$eval(dateSelector, element => element.value);
    const date = await date_.split('-').reverse().join('.');
    await page.waitForSelector(datetimeSelector);
    const datetime = await page.$eval(datetimeSelector, element => element.value);

    const [ _, teams, goals, assists, falls, best_players ] = await page.$$(teamLink);
    await teams.click();

    await page.waitForSelector(firstTeam);
    const first_command = await page.$eval(firstTeam, element => element.title);
    current.first_command = first_command;

    await page.waitForSelector(secondTeam);
    const second_command = await page.$eval(secondTeam, element => element.title);
    current.second_command = second_command;
    current.address = address;
    current.date = date;
    current.datetime = datetime;

    await goals.click();

    const Goals = await getPlayers(page, goal, '#голы-tab');
    current.goals = Goals;

    await assists.click();

    const Assists = await getPlayers(page, assist, '#ассисты-tab');
    current.assists = Assists;

    await falls.click();

    const Falls = await getPlayers(page, fall, '#фолы-tab');
    const FallsStatus = await getPlayers(page, fallStatus, '#фолы-tab');
    const falsResult = Falls.map((player, idx) => ({ player, status: FallsStatus[idx] }));
    current.falls = falsResult;
    
    await best_players.click();
    const BestPlayers = await getPlayers(page, best_player, '#cамые-ценные-игроки-tab')
    current.best_players = BestPlayers;
    
    result.push(current);
    page.close();
  }
  return result;
};

async function addActions(page, action, players, versus = '') {
  // variables
  const table = '#действия-в-матче-tab table tbody tr';
  const addBtn = '#действия-в-матче-tab .add-row a';
  const selectorBar = '.select2-results__option';

  for (let i = 0; i < players.length; i++) {
    const tableData = await page.$$(table);
    const lastForm = tableData.length - 3;

    await page.waitForSelector(`#elements-${lastForm} .field-element .select2-selection`, { visible: true });
    await page.click(`#elements-${lastForm} .field-element .select2-selection`);
    await selectYourChoice(page, selectorBar, action);
    await page.waitForSelector(`#elements-${lastForm} .field-player .select2-selection`, { visible: true });
    await page.click(`#elements-${lastForm} .field-player .select2-selection`);
    await selectYourChoice(page, selectorBar, players[i], versus);

    if ((tableData.length - 2) < players.length) {
      await page.waitForSelector(addBtn);
      await page.click(addBtn);
    }
  }
};

async function addPageContetn(browser, page, array, excepts_arr, tour, tourType) {
  // variables
  const actions = 'a[aria-controls="действия-в-матче-tab"]';
  // selects
  const first_command = '.field-team_one .select2-selection';
  const second_command = '.field-team_two .select2-selection';
  const judgeSelect = '.field-judge .select2-selection';
  const bestPlayerSelect = '.field-beat_player .select2-selection';
  const tourSelect = '.field-tour .select2-selection';
  const selectorBar = '.select2-results__option';
  const judges = [
    'Мелис Кыштообеков',
    'Мирбек Туманов',
    'Нурсултан Абдираев',
    'Азамат Садыбакасов',
  ];

  // inputs
  const date = '#id_date_0';
  const datetime = '#id_date_1';
  const location = '#id_location';

  let filtered_arr = [ ...array ];

  array.forEach(d => {
    for (let i = 0; i < excepts_arr.length; i++) {
      const [ firstTeam, secondTeam ] = excepts_arr[ i ];

      if (new RegExp(d.first_command, 'i').test(firstTeam) && new RegExp(d.second_command, 'i').test(secondTeam)) {
        filtered_arr = filtered_arr.map(f =>
          new RegExp(f?.first_command, 'i').test(firstTeam)
          ?
          new RegExp(f?.second_command, 'i').test(secondTeam) ?  null : f : f).filter(f => f !== null);
      }
    }
  });

  await page.waitForSelector('.container-fluid');
  const link = await page.$eval('.container-fluid .page-actions a', (element) => {
    return element.href;
  });

  for (let i = 0; i < filtered_arr.length; i++) {
    const newPage = await browser.newPage();
    await newPage.goto(link);

    
    // select first command
    await newPage.click(first_command);
    await selectYourChoice(newPage, selectorBar, filtered_arr[i].first_command);

    // select second command
    await newPage.click(second_command)
    await selectYourChoice(newPage, selectorBar, filtered_arr[i].second_command);

    // write date
    await newPage.type(date, filtered_arr[i].date);
    
    // write datetime
    await newPage.type(datetime, filtered_arr[i].datetime);
    
    // write datetime
    await newPage.type(location, filtered_arr[i].address);

    // select judge
    await newPage.click(judgeSelect);
    const judge = judges[Math.floor(Math.random() * judges.length)];
    await selectYourChoice(newPage, selectorBar, judge);

    // select best player
    for (let p = 0; p < filtered_arr[i].best_players.length; p++) {
      await newPage.click(bestPlayerSelect);
      await selectYourChoice(newPage, selectorBar, filtered_arr[i].best_players[p]);
    }

    // select second command
    await newPage.click(tourSelect);
    await selectYourChoice(newPage, selectorBar, `${tour} тур, ${tourType} сезон`);

    // click actions in a match
    await newPage.click(actions);

    const versus = [ filtered_arr[i].first_command, filtered_arr[i].second_command ].join('| vs |');

    // add assists
    const assists = filtered_arr[i].assists;
    await addActions(newPage, 'Ассист', assists, versus);

    // add falls
    const falls = filtered_arr[i].falls;
    // yellow cards
    const yellowCards = falls.filter(i => i.status === 'Желтая').map(({ player }) => player);
    await addActions(newPage, 'Желтая карточка', yellowCards, versus);
    // red cards
    const redCards = falls.filter(i => i.status === 'Краснач').map(({ player }) => player);
    await addActions(newPage, 'Красная карточка', redCards, versus);

    // add goals
    const goals = filtered_arr[i].goals;
    await addActions(newPage, 'Гол', goals, versus);
  }
  
};

module.exports = async function getContent(tour, division, tourType) {
  // global variables
  const form = '#changelist-search';
  const selectorBar = '.select2-results__option';
  const tourSelector = 'span[class="select2 select2-container select2-container--default"]';
  const submitBtn = '#search_group button';
  const resultTable = '#result_list tbody tr';

  // admin variables
  const usernameInp = 'input[name="username"]';
  const username = 'admin@admin.admin';
  const passwordInp = 'input[name="password"]';
  const password = '2022GeekTech';
  const adminBtn = 'button[type="submit"]';

  try {
    // open browser
    const browser = await puppeteer.launch({
      headless: false
    });
    const page = await browser.newPage();
    await page.goto(BASE_URL);

    console.clear();
    console.log('Идет сбор данных...');

    // if not logged in, then logged in
    const isAdmin = await page.url() === 'https://api.football.kg/admin/login/?next=/admin/match/match/';
    if (isAdmin) { 
      await page.type(usernameInp, username);
      await page.type(passwordInp, password);
      await page.click(adminBtn);
    }

    // awaiting, while elements dont will be add to DOM
    await page.waitForSelector(form);
    await page.waitForSelector(tourSelector);

    // selects
    const [ divisionSelect, tourSelect ] = await page.$$(tourSelector);

    // open tours select
    tourSelect.click();

    // select your tour
    const tour_regexp = `^${tour}-тур`;
    await selectYourChoice(page, selectorBar, tour_regexp);

    // open divisions select
    divisionSelect.click();

    // select your division
    await selectYourChoice(page, selectorBar, division);

    // submit
    await page.click(submitBtn);
 
    // table result
    await page.waitForSelector(resultTable);
    const result_list = await page.$$(resultTable);

    const result = await getPageContent(browser, result_list);

    // filling out the admin panel
    const admin = await browser.newPage();
    await admin.goto(ADMIN_URL);

    console.clear();
    console.log('Заполняется админка...');

    // if not logged in, then logged in
    const isAdminOpen = await admin.url() === 'https://afl.geekstudio.kg/admin/login/?next=/admin/championship/match/';
    if (isAdminOpen) { 
      await admin.type(usernameInp, 'admin');
      await admin.type(passwordInp, 'admin');
      await admin.click(adminBtn);

      await admin.goto(ADMIN_URL);
    }

    // awaiting, while elements dont will be add to DOM
    await admin.waitForSelector(form);
    await admin.waitForSelector(tourSelector);

    const [ t1, t2, dt, tourAdmin, season, league, divisionAdmin ] = await admin.$$(tourSelector);

    // select tour
    await tourAdmin.click();
    const regTour = `${tour} тур, ${tourType}`;
    await selectYourChoice(admin, selectorBar, regTour)

    // select division
    await divisionAdmin.click();
    await selectYourChoice(admin, selectorBar, division);

    // submit
    await admin.click(submitBtn);

    // filling
    await admin.waitForSelector(resultTable);
    const list_admin = await admin.$$(resultTable);

    const result_list_admin = [];

    for (const element of list_admin) {
      const text = await admin.evaluate(el => {
        const firstTeamAdmin = el.querySelector('.field-team_one').textContent;
        const secontTeamAdmin = el.querySelector('.field-team_two').textContent;
        return [ firstTeamAdmin, secontTeamAdmin ];
      }, element);
      result_list_admin.push(text);
    }
    
    if (result_list_admin.length !== result.length) {
      console.log('\nУже существующие команды:\n');
      console.log(result_list_admin.map(i => i.join('| vs |')).map(i => '   ' + i).join('\n'));
    } else {
      console.log('\nТур уже заполнен!');
    }

    await addPageContetn(browser, admin, result, result_list_admin, tour, tourType);
  } catch (err) {
    throw err;
  }
};
