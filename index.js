require("dotenv").config();
const { google } = require("googleapis");
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const adminId = "383858929";
const bot = new Telegraf(process.env.BOT_TOKEN);
// Завантаження даних з JSON
const credentials = require("./credentials.json");
// Збереження стану користувачів
let userState = {};
// Google Таблиця
const client = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);
const sheets = google.sheets({ version: "v4", auth: client });
const SPREADSHEET_ID = "118eAV4U4uRETpCFyvVBdgPAsRNe7LHw9ojh75PcIqH4"; //ID таблиці
// Function
// Запис даних у відповідну вкладку таблиці Google
async function addToSheet(userData, sheetName) {
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:E`,
    });

    const rows = result.data.values || [];
    let rowIndex = -1;

    let formattedUserDate = userData.date;
    let userTime = userData.time.trim();
    let lastValidDate = ""; // Запам'ятовуємо останню правильну дату

    console.log(`📌 Дата для запису: ${formattedUserDate}`);
    console.log(`📌 Час для запису: ${userTime}`);

    for (let i = 0; i < rows.length; i++) {
      console.log(`▶️ Перевірка рядка ${i}: ${rows[i]}`);

      let tableDate = rows[i][0] ? rows[i][0].trim() : "";
      let tableTime = rows[i][1] ? rows[i][1].trim() : "";

      // ✅ Якщо рядок містить дату, оновлюємо `lastValidDate`
      if (tableDate !== "") {
        lastValidDate = tableDate;
      }

      // ✅ Якщо "Дата" порожня, але "Година" відповідає, використовуємо останню відому дату
      if (
        tableDate === "" &&
        lastValidDate === formattedUserDate &&
        tableTime === userTime
      ) {
        rowIndex = i + 1;
        break;
      }

      // ✅ Якщо дата точно співпадає, використовуємо її
      if (tableDate === formattedUserDate && tableTime === userTime) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      console.error("❌ Помилка: Не знайдено відповідний рядок для запису!");
      return;
    }

    // ✅ Записуємо дані у знайдений рядок
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!C${rowIndex}:E${rowIndex}`,
      valueInputOption: "RAW",
      resource: {
        values: [[userData.name, userData.phone, userData.weddingDate]],
      },
    });

    console.log(
      `✅ Запис додано у вкладку "${sheetName}", дата ${formattedUserDate}, час ${userTime}!`
    );
  } catch (error) {
    console.error(
      "❌ Помилка запису в таблицю:",
      error.response ? error.response.data : error
    );
  }
}
// Зміна кольру для повторної примірки
async function highlightRepeatTime(sheetName, formattedDate, selectedTime) {
  try {
      console.log(`🚀 Починаємо зміну кольору для часу: ${selectedTime} на ${formattedDate}`);

      selectedTime = selectedTime.trim();
      formattedDate = formattedDate.trim();
      console.log(`✅ Виправлений формат часу: ${selectedTime}`);
      console.log(`✅ Виправлений формат дати: ${formattedDate}`);

      // ✅ Отримуємо всі значення з таблиці (колонки "Дата" та "Година")
      const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:B`,
      });

      if (!result.data.values) {
          console.error("❌ Помилка: Дані з таблиці не отримані!");
          return;
      }

      const rows = result.data.values || [];
      let rowIndex = -1;
      let lastValidDate = ""; // Запам’ятовуємо останню правильну дату

      console.log("📌 Завантажені рядки:", rows);

      // ✅ Шукаємо точний рядок з датою та часом
      for (let i = 0; i < rows.length; i++) {
          let tableDate = rows[i][0] ? rows[i][0].trim() : "";
          let tableTime = rows[i][1] ? rows[i][1].trim() : "";

          console.log(`▶️ Перевірка рядка ${i}: Дата: "${tableDate}", Час: "${tableTime}"`);

          // ✅ Якщо рядок містить дату, оновлюємо `lastValidDate`
          if (tableDate !== "") {
              lastValidDate = tableDate;
          }

          // ✅ Якщо комірка "Дата" порожня, але час відповідає, використовуємо останню відому дату
          if (tableDate === "" && lastValidDate === formattedDate && tableTime === selectedTime) {
              rowIndex = i;
              break;
          }

          // ✅ Якщо дата та час точно співпадають, використовуємо цей рядок
          if (tableDate === formattedDate && tableTime === selectedTime) {
              rowIndex = i;
              break;
          }
      }

      if (rowIndex === -1) {
          console.error(`❌ Помилка: Не знайдено час ${selectedTime} на дату ${formattedDate}!`);
          return;
      }

      console.log(`✅ Рядок знайдено: ${rowIndex + 1}`);

      // ✅ Отримуємо `sheetId`
      const sheetInfo = await sheets.spreadsheets.get({
          spreadsheetId: SPREADSHEET_ID,
      });

      const sheetId = sheetInfo.data.sheets.find(s => s.properties.title === sheetName)?.properties.sheetId;

      if (!sheetId) {
          console.error("❌ Помилка: Не знайдено sheetId для вкладки!");
          return;
      }

      console.log(`✅ sheetId: ${sheetId}`);

      // ✅ Відправляємо запит на зміну кольору
      await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
              requests: [
                  {
                      repeatCell: {
                          range: {
                              sheetId: sheetId,
                              startRowIndex: rowIndex,
                              endRowIndex: rowIndex + 1,
                              startColumnIndex: 1, // ✅ Колонка "Година"
                              endColumnIndex: 2,
                          },
                          cell: {
                              userEnteredFormat: {
                                  backgroundColor: { red: 1, green: 0, blue: 1 }, // Фіолетовий
                              },
                          },
                          fields: "userEnteredFormat.backgroundColor",
                      },
                  },
              ],
          },
      });

      console.log(`✅ Час ${selectedTime} на дату ${formattedDate} виділений Фіолетовим кольором!`);
  } catch (error) {
      console.error("❌ Помилка зміни кольору:", error);
  }
}
// Функція для отримання доступних годин
async function getAvailableHours(sheetName, date) {
  console.log("📌 Виклик getAvailableHours() для:", sheetName, date);

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:E`,
    });

    console.log("📌 Дані з таблиці:", result.data.values);

    const rows = result.data.values || [];
    let availableHours = [];
    let dateReached = false;

    for (let i = 0; i < rows.length; i++) {
      console.log(`▶️ Рядок ${i}: ${rows[i]}`);

      if (rows[i][0] === date) {
        dateReached = true;
      }

      if (dateReached && rows[i][0] && rows[i][0] !== date) {
        break;
      }

      // ✅ Додаємо тільки цілі години (відсікаємо 11:30, 12:30 і т. д.)
      if (dateReached && (!rows[i][2] || rows[i][2].trim() === "")) {
        let hour = rows[i][1];
        if (hour && hour.endsWith(":00")) {
          availableHours.push(hour);
        }
      }
    }

    console.log("✅ Доступні години:", availableHours);
    return availableHours.length ? availableHours : ["Немає доступних годин"];
  } catch (error) {
    console.error("❌ Помилка отримання годин із таблиці:", error);
    return ["Помилка отримання даних"];
  }
}
// Перетворення "Січень 1" → "01.01"
function formatDateToMatchSheet(date) {
  if (!date || typeof date !== "string") {
    console.error("❌ Помилка: Неправильне значення дати:", date);
    return "";
  }

  const parts = date.split(" ");
  if (parts.length !== 2) {
    console.error("❌ Неправильний формат дати:", date);
    return "";
  }

  const [month, day] = parts;

  // ✅ Перетворюємо день у формат `01` (додаємо нуль, якщо це однозначне число)
  const formattedDay = day.length === 1 ? `0${day}` : day;

  const formattedDate = `${formattedDay}.${convertMonthToNumber(month)}`;
  console.log("📌 Коректне форматування дати:", formattedDate);

  return formattedDate;
}
// Конвертація тексту в число
function convertMonthToNumber(month) {
  const months = {
    Січень: "01",
    Лютий: "02",
    Березень: "03",
    Квітень: "04",
    Травень: "05",
    Червень: "06",
    Липень: "07",
    Серпень: "08",
    Вересень: "09",
    Жовтень: "10",
    Листопад: "11",
    Грудень: "12",
  };
  return months[month] || "00";
}
// Сповіщення
const scheduleReminder = async (userId) => {
  const userData = userState[userId];

  if (!userData?.date || !userData?.time) {
      console.error("❌ Помилка: Немає достатніх даних для нагадування!");
      return;
  }

  console.log(`📌 Перевірка дати перед обробкою: ${userData.date} ${userData.time}`); // ✅ Лог

  // ✅ Розбираємо дату та час
  let dateParts = userData.date.split(".");
  let timeParts = userData.time.split(":");
  
  if (dateParts.length === 2) {
      dateParts.push(new Date().getFullYear().toString()); // ✅ Додаємо поточний рік
  }

  const [day, month, year] = dateParts;
  const [hours, minutes] = timeParts;

  if (!day || !month || !year || !hours || !minutes) {
      console.error("❌ Помилка: Невірний формат дати або часу! Очікується dd.mm.yyyy hh:mm.");
      return;
  }

  console.log(`✅ Визначена дата: ${day}.${month}.${year} ${hours}:${minutes}`); // ✅ Лог для перевірки

  // ✅ Створюємо точний час примірки
  const meetingTime = new Date(year, month - 1, day, hours, minutes, 0);
  const currentDate = new Date();
  const timeDifference = meetingTime.getTime() - currentDate.getTime();

  let reminderTime;
  
  if (timeDifference > 24 * 60 * 60 * 1000) {
      // ✅ Якщо більше 24 годин → нагадування за 24 години
      reminderTime = new Date(meetingTime);
      reminderTime.setHours(reminderTime.getHours() - 24);
  } else {
      // ✅ Якщо менше 24 годин → нагадування за 2 години
      reminderTime = new Date(meetingTime);
      reminderTime.setHours(reminderTime.getHours() - 2);
  }

  const timeUntilReminder = reminderTime.getTime() - currentDate.getTime();

  console.log(`📌 Заплановане нагадування: ${reminderTime}`); // ✅ Лог

  if (timeUntilReminder > 0) {
      setTimeout(() => {
          bot.telegram.sendMessage(
              userId,
              `🔔 Нагадування! Ваша примірка вже скоро! 👗\n 
                  📍 *Адреса:* вул. Івана Франка , 47\n
                  📞 *Контакт:* +38068 36 99 363\n
                  🔗 *Instagram:* [ROSE](https://www.instagram.com/rose.weddingdresses/)\n
                  🗺 *Google Maps:* [Локація](https://maps.app.goo.gl/cZMoFfkqisuKRT7g6)\n
                  ✨ **До зустрічі у ROSE!**\n`
          );
      }, timeUntilReminder);

      console.log(`✅ Нагадування заплановане на: ${reminderTime}`);
  } else {
      console.error("❌ Помилка: Час нагадування некоректний, перевірте дату!");
  }
};
// Інтерфейс + логіка
bot.start((ctx) => {
  ctx.reply(
    "🌹 Ласкаво просимо до *ROSE Wedding Dresses*! Оберіть потрібний розділ:",
    Markup.keyboard([
      ["👗 Записатись на примірку сукні", "🔁 Повторна примірка"],
      ["✂️ Записатись до кравчині", "📞 Контактна інформація"],
      ["🕒 Графік роботи"]
    ]).resize()
  );
});
bot.hears("✂️ Записатись до кравчині", (ctx) => {
    ctx.reply("🌹 **Запис до кравчині**\n\n" +
              "✨ Примірка з кравчинeю відбувається через наш Instagram.\n\n" +
              "📌 Для запису, будь ласка, надішліть нам таку інформацію:\n" +
              "✔️ **Прізвище та ім'я нареченої**\n" +
              "✔️ **Дата весілля**\n" +
              "✔️ **Фото договору** (для швидкого пошуку вашого замовлення)\n\n" +
              "💖 Після отримання даних менеджер запропонує вам доступні дати та години примірки, і ви зможете вибрати зручний час.\n\n" +
              "✨ Важливо: **Майте з собою взуття**, яке плануєте одягати на весілля—це необхідно для корекції довжини сукні.\n\n" +
              "🔗 **Записатися:** [Instagram ROSE Wedding Dresses](https://www.instagram.com/rose.weddingdresses/)",
              { parse_mode: "Markdown" });
});
bot.hears("📞 Контактна інформація", (ctx) => {
  ctx.reply(
    "Контактна інформація:\n📍 Адреса: вул. Івана Франка 47 \n📞 Телефон: +38068 36 99 363\n📸 [Instagram](https://www.instagram.com/rose.weddingdresses/)\n🗺 [Локація](https://maps.app.goo.gl/cZMoFfkqisuKRT7g6)",
    { parse_mode: "Markdown" }
  );
});
bot.hears("🕒 Графік роботи", (ctx) => {
  ctx.reply(
    "🕒 Графік роботи:\n▪️ **Пн-Пт:** 11:00 - 19:00\n▪️ **Сб-Нд:** 11:00 - 18:00 (попередній запис)",
    { parse_mode: "Markdown" }
  );
});
bot.hears("👗 Записатись на примірку сукні", (ctx) => {
  const userId = ctx.from.id;
  userState[userId] = { stage: "month" };

  ctx.reply(
    "📅 Оберіть місяць для примірки:",
    Markup.inlineKeyboard([
      [
        { text: "Січень", callback_data: "month_Січень" },
        { text: "Лютий", callback_data: "month_Лютий" },
        { text: "Березень", callback_data: "month_Березень" },
      ],
      [
        { text: "Квітень", callback_data: "month_Квітень" },
        { text: "Травень", callback_data: "month_Травень" },
        { text: "Червень", callback_data: "month_Червень" },
      ],
      [
        { text: "Липень", callback_data: "month_Липень" },
        { text: "Серпень", callback_data: "month_Серпень" },
        { text: "Вересень", callback_data: "month_Вересень" },
      ],
      [
        { text: "Жовтень", callback_data: "month_Жовтень" },
        { text: "Листопад", callback_data: "month_Листопад" },
        { text: "Грудень", callback_data: "month_Грудень" },
      ],
    ])
  );
});
bot.hears("🔁 Повторна примірка", (ctx) => {
  const userId = ctx.from.id;
  userState[userId] = { stage: "month_repeat" };

  ctx.reply("📅 Оберіть місяць для повторної примірки:", Markup.inlineKeyboard([
    [{ text: "Січень", callback_data: "repeat_month_Січень" }, { text: "Лютий", callback_data: "repeat_month_Лютий" }, { text: "Березень", callback_data: "repeat_month_Березень" }],
    [{ text: "Квітень", callback_data: "repeat_month_Квітень" }, { text: "Травень", callback_data: "repeat_month_Травень" }, { text: "Червень", callback_data: "repeat_month_Червень" }],
    [{ text: "Липень", callback_data: "repeat_month_Липень" }, { text: "Серпень", callback_data: "repeat_month_Серпень" }, { text: "Вересень", callback_data: "repeat_month_Вересень" }],
    [{ text: "Жовтень", callback_data: "repeat_month_Жовтень" }, { text: "Листопад", callback_data: "repeat_month_Листопад" }, { text: "Грудень", callback_data: "repeat_month_Грудень" }]
  ]));
});
// Вибір Місяця дати та години на повторну примірку
bot.action(/^repeat_month_/, async (ctx) => {
  const userId = ctx.from.id;

  console.log(`📌 Отримано callback_data: ${ctx.match.input}`);
  
  // ✅ Оновлена логіка: витягуємо місяць правильно (третій елемент масиву)
  const month = ctx.match.input.split("_")[2]?.trim();
  
  if (!month) { 
      console.error("❌ Помилка: Місяць не визначено!");
      ctx.reply("⚠ Виберіть місяць ще раз.");
      return;
  }

  userState[userId] = { month, stage: "date_repeat" };
  console.log(`✅ Користувач обрав повторний місяць: ${month}`);

  // Формуємо кнопки вибору дати
  const dateButtons = [];
  for (let i = 1; i <= 31; i += 5) {
      const row = [];
      for (let j = 0; j < 5 && i + j <= 31; j++) {
          row.push({ text: `${i + j}`, callback_data: `repeat_date_${i + j}` });
      }
      dateButtons.push(row);
  }

  ctx.reply(`🌹 Ви обрали *${month}*. Оберіть дату повторної примірки:`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: dateButtons }
  });
});
bot.action(/^repeat_date_/, async (ctx) => {
  const userId = ctx.from.id;
  console.log(`📌 Отримано callback_data: ${ctx.match.input}`);

  let selectedDay = ctx.match.input.split("_")[2]?.trim();
  if (!selectedDay || isNaN(selectedDay)) {
      console.error("❌ Помилка: День не визначено!");
      ctx.reply("⚠️ Виберіть дату ще раз.");
      return;
  }

  const selectedMonth = userState[userId]?.month;
  if (!selectedMonth) {
      console.error("❌ Помилка: Місяць не визначено!");
      ctx.reply("⚠️ Виберіть місяць перед вибором дати.");
      return;
  }

  selectedDay = selectedDay.replace(/\D/g, "");
  const formattedDay = selectedDay.length === 1 ? `0${selectedDay}` : selectedDay;
  const formattedDate = `${formattedDay}.${convertMonthToNumber(selectedMonth)}`;
  userState[userId].date = formattedDate;

  console.log(`✅ Користувач обрав повторну дату: ${formattedDate}`);

  // ✅ Отримуємо доступні години **з таблиці** замість статичного масиву
  const availableHours = await getAvailableHours(userState[userId].month, userState[userId].date);

  console.log("✅ Отримані години для вибору:", availableHours);

  if (availableHours.length === 0 || availableHours.includes("Немає доступних годин")) {
      ctx.reply(`❌ Всі години для *${formattedDate}* зайняті. Оберіть іншу дату.`);
      return;
  }

  // ✅ Створюємо кнопки з доступними годинами (як у `date_`)
  const hourButtons = [];
  const row = [];

  availableHours.forEach((hour) => {
      row.push({ text: hour, callback_data: `repeat_time_${hour}` });

      if (row.length === 4) {
          hourButtons.push([...row]);
          row.length = 0;
      }
  });

  if (row.length > 0) {
      hourButtons.push([...row]);
  }

  ctx.reply("🌹 Оберіть доступну годину:", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: hourButtons },
  });
});
bot.action(/^repeat_time_/, async (ctx) => {
  const userId = ctx.from.id;
  const selectedTime = ctx.match.input.split("_")[2];

  console.log(`📌 Отримано callback_data: ${ctx.match.input}`);
  
  if (!selectedTime) {
      console.error("❌ Помилка: Час не визначено!");
      ctx.reply("⚠️ Виберіть годину ще раз.");
      return;
  }

  userState[userId].time = selectedTime;
  userState[userId].stage = "name_repeat";

  console.log(`✅ Користувач обрав повторний час: ${selectedTime}`);

  ctx.reply("🌹 Введіть ваше *ім'я та прізвище*:", { parse_mode: "Markdown" });
  scheduleReminder(userId);
});
// Вибір Місяця дати та години на першу примірку
bot.action(/^month_/, async (ctx) => {
  const userId = ctx.from.id;
  const month = ctx.match.input.split("_")[1];

  userState[userId] = { month, stage: "date" };

  console.log(`✅ Користувач обрав місяць: ${month}`);

  // Створюємо кнопки для вибору дат у рядках по 4 кнопки
  const dateButtons = [];
  const row = [];

  for (let i = 1; i <= 31; i++) {
    row.push({ text: `${i}`, callback_data: `date_${i}` });

    if (row.length === 5 || i === 31) {
      // Додаємо по 5 кнопки у рядок
      dateButtons.push([...row]);
      row.length = 0; // Очищаємо масив після додавання в основний список
    }
  }

  ctx.reply(`🌹 Ви обрали *${month}*. Оберіть дату:`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: dateButtons },
  });
});
bot.action(/^date_/, async (ctx) => {
  const userId = ctx.from.id;
  const selectedDay = ctx.match.input.split("_")[1];

  const selectedMonth = userState[userId]?.month;
  if (!selectedMonth) {
    console.error("❌ Помилка: місяць не визначено!");
    ctx.reply("⚠️ Виберіть місяць перед вибором дати.");
    return;
  }

  const formattedDate = formatDateToMatchSheet(
    `${selectedMonth} ${selectedDay}`
  );

  if (!formattedDate || formattedDate === "00.00.2025") {
    console.error(
      "❌ Критична помилка: Некоректне форматування дати!",
      selectedMonth,
      selectedDay
    );
    ctx.reply("⚠️ Неправильна дата! Спробуйте ще раз.");
    return;
  }

  userState[userId].date = formattedDate;
  console.log(
    "✅ Дата остаточно збережена у userState:",
    userState[userId].date
  );

  // ✅ Отримуємо доступні години
  const availableHours = await getAvailableHours(
    userState[userId].month,
    userState[userId].date
  );

  console.log("✅ Отримані години для вибору:", availableHours);

  if (
    availableHours.length === 0 ||
    availableHours.includes("Немає доступних годин")
  ) {
    ctx.reply(
      `❌ Всі години для *${formattedDate}* зайняті. Оберіть іншу дату.`
    );
    return;
  }

  // ✅ Створюємо кнопки з годинами у рядках по 4 кнопки
  const hourButtons = [];
  const row = [];

  availableHours.forEach((hour) => {
    row.push({ text: hour, callback_data: `time_${hour}` });

    if (row.length === 4) {
      // Додаємо по 4 кнопки у рядок
      hourButtons.push([...row]);
      row.length = 0;
    }
  });

  if (row.length > 0) {
    hourButtons.push([...row]); // Додаємо останні кнопки, якщо залишились
  }

  ctx.reply("🌹 Оберіть доступну годину:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: hourButtons },
  });
});
bot.action(/^time_/, async (ctx) => {
  const userId = ctx.from.id;
  const selectedTime = ctx.match.input.split("_")[1];

  // ✅ Перевіряємо, чи час зайнятий
  const availableHours = await getAvailableHours(
    userState[userId].month,
    userState[userId].date
  );

  if (!availableHours.includes(selectedTime)) {
    ctx.reply("❌ Немає доступних годин для цього часу. Оберіть інший!");
    return;
  }

  userState[userId].time = selectedTime;
  userState[userId].stage = "name_first";

  ctx.reply("🌹 Введіть ваше *ім'я та прізвище*:", { parse_mode: "Markdown" });
  scheduleReminder(userId);
});
// Введення особистих даних
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  if (!userState[userId]) {
      console.error("❌ Помилка: userState не ініціалізований!");
      return;
  }

  const userStage = userState[userId].stage;
  console.log(`📌 Поточний етап користувача: ${userStage}`);

  // ✅ Оголошуємо phoneRegex на верхньому рівні для доступу в усіх кейсах
  const phoneRegex = /^\+\d{2,3}\d{9,10}$/;

  switch (userStage) {
      // 🔹 Перша примірка
      case "name_first":
      case "name_repeat":
          userState[userId].name = ctx.message.text;
          userState[userId].stage = userStage === "name_first" ? "phone_first" : "phone_repeat";  
          ctx.reply("📞 Введіть ваш *номер телефону* (формат: +38097 777 77 77):");
          break;

      case "phone_first":
      case "phone_repeat":
          if (!phoneRegex.test(ctx.message.text)) {
              ctx.reply("❌ Неправильний формат номера! Введіть у форматі: +38097 777 77 77.");
              return;
          }
          userState[userId].phone = ctx.message.text;
          userState[userId].stage = userStage === "phone_first" ? "weddingDate_first" : "weddingDate_repeat";  
          ctx.reply("💍 Вкажіть *дату весілля* або напишіть «ще немає дати»:");
          break;

      case "weddingDate_first":
      case "weddingDate_repeat":
          userState[userId].weddingDate = ctx.message.text;
          const sheetName = userState[userId]?.month;
          const formattedDate = userState[userId]?.date;
          const selectedTime = userState[userId]?.time;

          console.log(`📌 Дані для запису: Місяць - ${sheetName}, Дата - ${formattedDate}, Час - ${selectedTime}`);

          if (!sheetName || !formattedDate || !selectedTime) {
              console.error("❌ Помилка: Дані для запису не визначені!");
              ctx.reply("⚠ Виникла проблема із записом у таблицю. Спробуйте ще раз.");
              return;
          }

          try {
              addToSheet(userState[userId], sheetName, `${sheetName}!A:E`);
              
              if (userStage === "weddingDate_repeat") {
                  highlightRepeatTime(sheetName, formattedDate, selectedTime);
              }

              // ✅ Повідомлення користувачу про успішний запис  
              const userConfirmationMessage = userStage === "weddingDate_first" 
                  ? "🌹 **Ваш запис підтверджено!**\n\n" +
                    "✨ Дякуємо, що обрали *ROSE Wedding Dresses*! " +
                    "Ваша зустріч запланована, і ми вже готуємо для вас найкращі моделі суконь.\n\n" +
                    "📅 **Дата:** " + formattedDate + "\n" +
                    "⏰ **Час:** " + selectedTime + "\n\n" +
                    "🕙 Ця зустріч дає вам **1 годину**, щоб переглянути та знайти улюблену модель та зробити вибір!\n\n" +
                    "💖 Ми нагадаємо вам про примірку, щоб ви нічого не пропустили!\n\n" +
                    "🌹 *Створюємо ваш ідеальний образ для особливого дня!*\n\n" +
                    "✨ **До зустрічі у ROSE!**\n\n" +
                    "📍 *Адреса:* вул. Івана Франка , 47\n" +
                    "📞 *Контакт:* +38068 36 99 363\n" +
                    "🔗 *Instagram:* [ROSE](https://www.instagram.com/rose.weddingdresses/)\n" +
                    "🗺 *Google Maps:* [Локація](https://maps.app.goo.gl/cZMoFfkqisuKRT7g6)\n"
                  : "🌹 **Ваш повторний запис підтверджено!**\n\n" +
                    "✨ Дякуємо що Ви обрали двічі ROSE Wedding Dresses.\n\n" +
                    "🕙 Ця зустріч дає вам **30 хвилин**, щоб ще раз переглянути улюблені моделі та зробити фінальний вибір!\n\n" +
                    "📅 **Дата повторної примірки:** " + formattedDate + "\n" +
                    "⏰ **Час:** " + selectedTime + "\n\n" +
                    "💖 Ми нагадаємо вам про примірку за **1 день до зустрічі**, щоб ви нічого не пропустили.\n\n" +
                    "👗 Надішліть нам **фото ** вподобаних суконь чи їхні назви або якщо у вас є **візитка** з нашого салону із записаними моделями надішліть нам у **Instagram** щоб ми могли заздалегідь підготувати їх для вас!\n\n" +
                    "✨ **До зустрічі у ROSE!**\n\n" +
                    "📍 *Адреса:* вул. Івана Франка, 47\n" +
                    "📞 *Контакт:* +38068 36 99 363\n" +
                    "🔗 *Instagram:* [ROSE](https://www.instagram.com/rose.weddingdresses/)\n" +
                    "🗺 *Google Maps:* [Локація](https://maps.app.goo.gl/cZMoFfkqisuKRT7g6)\n";

              ctx.reply(userConfirmationMessage, { parse_mode: "Markdown" });
              scheduleReminder(userId);

              // ✅ Сповіщення адміністратору  
              const userTelegramLink = `https://t.me/${ctx.from.username || "Немає користувацького імені"}`;
              const adminMessageType = userStage === "weddingDate_first" ? "Новий запис" : "Повторний запис";
              const adminMessage = `🔔 **${adminMessageType} на примірку!**  
              📅 Місяць: *${sheetName}*  
              📆 Дата: *${formattedDate}*  
              ⏰ Час: *${selectedTime}*  
              👤 Ім'я: ${userState[userId].name}  
              📞 Телефон: ${userState[userId].phone}  
              💍 Дата весілля: ${userState[userId].weddingDate}  
              🔗 Телеграм: [${ctx.from.first_name || ""} ${ctx.from.last_name || ""}](${userTelegramLink})`;

              ctx.telegram.sendMessage(adminId, adminMessage, {
                  parse_mode: "Markdown",
              });

          } catch (error) {
              console.error("❌ Помилка запису в таблицю:", error);
              ctx.reply("⚠ Виникла проблема із записом у Google Таблицю. Спробуйте пізніше.");
          }

          delete userState[userId];
          break;

      default:
          console.warn(`⚠️ Невідомий етап: ${userStage}`);
          ctx.reply("❌ Виникла помилка. Будь ласка, спробуйте ще раз.");
  }
});
// Запуска бота
bot.launch();
console.log("✅ Бот запущено!");
