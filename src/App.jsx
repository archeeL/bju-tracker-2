import React, { useEffect, useMemo, useState } from "react";

const FOOD_DB = {
  банан: { per100: { p: 1.1, f: 0.3, c: 23, kcal: 96 }, piece: 120 },
  яйцо: { per100: { p: 12.6, f: 10.6, c: 1.1, kcal: 143 }, piece: 50 },
  рис: { per100: { p: 2.7, f: 0.3, c: 28, kcal: 130 } },
  молоко: { per100: { p: 3, f: 3.2, c: 4.7, kcal: 60 } },
  яблоко: { per100: { p: 0.3, f: 0.2, c: 14, kcal: 52 }, piece: 180 },
  овсянка: { per100: { p: 12.3, f: 6.1, c: 59.5, kcal: 342 }, spoon: 15 },
  "куриная грудка": { per100: { p: 31, f: 3.6, c: 0, kcal: 165 } },
  хлеб: { per100: { p: 8, f: 3.2, c: 49, kcal: 265 }, slice: 30 },
  сыр: { per100: { p: 25, f: 33, c: 1.3, kcal: 402 }, slice: 25 },
  картофель: { per100: { p: 2, f: 0.4, c: 17, kcal: 77 } },
  творог: { per100: { p: 16, f: 5, c: 3, kcal: 121 } },
  вода: { waterOnly: true },
};

const ALIASES = {
  банан: "банан",
  банана: "банан",
  бананы: "банан",

  яйцо: "яйцо",
  яйца: "яйцо",
  яиц: "яйцо",

  рис: "рис",
  риса: "рис",

  молоко: "молоко",
  молока: "молоко",

  яблоко: "яблоко",
  яблока: "яблоко",

  овсянка: "овсянка",
  овсянки: "овсянка",

  "куриная грудка": "куриная грудка",
  курица: "куриная грудка",
  курицу: "куриная грудка",
  грудка: "куриная грудка",
  грудки: "куриная грудка",

  хлеб: "хлеб",
  хлеба: "хлеб",

  сыр: "сыр",
  сыра: "сыр",

  картофель: "картофель",
  картошка: "картофель",
  картошки: "картофель",

  творог: "творог",
  творога: "творог",

  вода: "вода",
  воды: "вода",
};

const NUMBER_WORDS = {
  один: 1,
  одна: 1,
  одно: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
};

const DEFAULT_SETTINGS = {
  proteinGoal: 120,
  fatGoal: 60,
  carbsGoal: 220,
  caloriesGoal: 2000,
  waterGoal: 2000,
};

const STORAGE_KEYS = {
  entries: "bju_v2_entries",
  settings: "bju_v2_settings",
  bmi: "bju_v2_bmi",
};

function round1(value) {
  return Math.round(value * 10) / 10;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return formatDateKey(new Date());
}

function shiftDate(dateKey, amount) {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() + amount);
  return formatDateKey(d);
}

function formatDateLabel(dateKey) {
  return new Date(dateKey + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getMonthData(dateKey) {
  const current = new Date(dateKey + "T12:00:00");
  const year = current.getFullYear();
  const month = current.getMonth();
  const first = new Date(year, month, 1, 12);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(formatDateKey(new Date(year, month, day, 12)));
  }

  return {
    label: current.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    }),
    cells,
  };
}

function shiftMonth(dateKey, amount) {
  const d = new Date(dateKey + "T12:00:00");
  d.setMonth(d.getMonth() + amount);
  return formatDateKey(new Date(d.getFullYear(), d.getMonth(), 1, 12));
}

function normalizeText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ");
}

function resolveProduct(text) {
  const direct = ALIASES[text];
  if (direct) return direct;

  const matches = Object.keys(ALIASES).filter((key) => text.includes(key));
  if (matches.length === 0) return null;

  matches.sort((a, b) => b.length - a.length);
  return ALIASES[matches[0]];
}

function parseSmartEntry(rawInput) {
  const normalizedWords = normalizeText(rawInput)
    .split(" ")
    .map((word) => (NUMBER_WORDS[word] ? String(NUMBER_WORDS[word]) : word));

  const text = normalizedWords.join(" ");
  if (!text) return { error: "Введите продукт или воду" };

  const product = resolveProduct(text);
  if (!product) {
    return {
      error:
        "Не знаю такой продукт. Попробуй: 1 банан, 2 яйца, 150 рис, 200 молоко, 300 вода",
    };
  }

  const db = FOOD_DB[product];

  const amountMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(г|гр|мл|шт|стакан|стакана|стаканов|ломтик|ломтика|ломтиков|ложка|ложки|ложек)?/
  );
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 1;
  const unit = amountMatch?.[2] || null;

  if (product === "вода") {
    let ml = 250;

    if (unit === "мл") ml = amount;
    else if (unit && unit.startsWith("стакан")) ml = amount * 250;
    else if (!unit && amountMatch) ml = amount;
    else ml = 250;

    return {
      type: "water",
      product,
      label: text,
      quantity: ml,
      waterMl: ml,
      macros: { p: 0, f: 0, c: 0, kcal: 0 },
      source: "manual",
    };
  }

  let quantity = 0;

  if (unit === "г" || unit === "гр" || unit === "мл") {
    quantity = amount;
  } else if (unit === "шт") {
    quantity = amount * (db.piece || 100);
  } else if (unit && unit.startsWith("стакан")) {
    quantity = amount * 250;
  } else if (unit && unit.startsWith("ложк")) {
    quantity = amount * (db.spoon || 15);
  } else if (unit && unit.startsWith("ломтик")) {
    quantity = amount * (db.slice || 25);
  } else if (!unit) {
    if (db.piece) quantity = amount * db.piece;
    else quantity = amount * 100;
  } else {
    quantity = amount * 100;
  }

  const ratio = quantity / 100;
  const macros = {
    p: round1(db.per100.p * ratio),
    f: round1(db.per100.f * ratio),
    c: round1(db.per100.c * ratio),
    kcal: round1(db.per100.kcal * ratio),
  };

  return {
    type: "food",
    product,
    label: text,
    quantity,
    waterMl: 0,
    macros,
    source: "manual",
  };
}

function calculateBmi(weightKg, heightCm) {
  const h = heightCm / 100;
  if (!weightKg || !heightCm || h <= 0) return null;
  return weightKg / (h * h);
}

function getBmiCategory(bmi) {
  if (bmi == null) return "—";
  if (bmi < 18.5) return "Ниже нормы";
  if (bmi < 25) return "Норма";
  if (bmi < 30) return "Выше нормы";
  return "Ожирение";
}

function App() {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [calendarMonth, setCalendarMonth] = useState(
    formatDateKey(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12)
    )
  );
  const [entriesByDate, setEntriesByDate] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [bmiData, setBmiData] = useState({ height: 175, weight: 70 });
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [showManualInput, setShowManualInput] = useState(true);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");

  useEffect(() => {
    const savedEntries = localStorage.getItem(STORAGE_KEYS.entries);
    const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
    const savedBmi = localStorage.getItem(STORAGE_KEYS.bmi);

    if (savedEntries) {
      try {
        setEntriesByDate(JSON.parse(savedEntries));
      } catch {}
    }

    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } catch {}
    }

    if (savedBmi) {
      try {
        setBmiData(JSON.parse(savedBmi));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entriesByDate));
  }, [entriesByDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.bmi, JSON.stringify(bmiData));
  }, [bmiData]);

  useEffect(() => {
    const d = new Date(selectedDate + "T12:00:00");
    setCalendarMonth(formatDateKey(new Date(d.getFullYear(), d.getMonth(), 1, 12)));
  }, [selectedDate]);

  const dayEntries = entriesByDate[selectedDate] || [];

  const totals = useMemo(() => {
    return dayEntries.reduce(
      (acc, item) => {
        acc.p += item.macros.p;
        acc.f += item.macros.f;
        acc.c += item.macros.c;
        acc.kcal += item.macros.kcal;
        acc.water += item.waterMl || 0;
        return acc;
      },
      { p: 0, f: 0, c: 0, kcal: 0, water: 0 }
    );
  }, [dayEntries]);

  const monthData = useMemo(() => getMonthData(calendarMonth), [calendarMonth]);

  const bmiValue = useMemo(
    () => calculateBmi(Number(bmiData.weight), Number(bmiData.height)),
    [bmiData]
  );

  function addEntry() {
    const parsed = parseSmartEntry(input);

    if (parsed.error) {
      setMessage(parsed.error);
      return;
    }

    const newEntry = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...parsed,
    };

    setEntriesByDate((prev) => ({
      ...prev,
      [selectedDate]: [newEntry, ...(prev[selectedDate] || [])],
    }));

    setInput("");
    setMessage(`Добавлено: ${parsed.label}`);
  }

  function removeEntry(id) {
    setEntriesByDate((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] || []).filter((item) => item.id !== id),
    }));
  }

  function addQuickWater(ml) {
    const waterEntry = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      type: "water",
      product: "вода",
      label: `${ml} мл воды`,
      quantity: ml,
      waterMl: ml,
      macros: { p: 0, f: 0, c: 0, kcal: 0 },
      source: "quick-water",
    };

    setEntriesByDate((prev) => ({
      ...prev,
      [selectedDate]: [waterEntry, ...(prev[selectedDate] || [])],
    }));
  }

  function clearDay() {
    setEntriesByDate((prev) => ({
      ...prev,
      [selectedDate]: [],
    }));
  }

  function updateSetting(key, value) {
    setSettings((prev) => ({
      ...prev,
      [key]: Number(value || 0),
    }));
  }

  function updateBmiField(key, value) {
    setBmiData((prev) => ({
      ...prev,
      [key]: Number(value || 0),
    }));
  }

  function onPhotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    setPhotoMessage(
      "Фото загружено. Следующим шагом сюда можно будет подключить AI-разбор еды."
    );
  }

  const waterPercent = Math.min(
    100,
    settings.waterGoal > 0 ? (totals.water / settings.waterGoal) * 100 : 0
  );

  const statCards = [
    {
      title: "Белки",
      value: round1(totals.p),
      goal: settings.proteinGoal,
      unit: "г",
    },
    {
      title: "Жиры",
      value: round1(totals.f),
      goal: settings.fatGoal,
      unit: "г",
    },
    {
      title: "Углеводы",
      value: round1(totals.c),
      goal: settings.carbsGoal,
      unit: "г",
    },
    {
      title: "Калории",
      value: round1(totals.kcal),
      goal: settings.caloriesGoal,
      unit: "ккал",
    },
  ];

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <>
      <style>{`
        :root {
          color: #e7edf8;
          background: #08101a;
          font-family: Inter, system-ui, Arial, sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          min-width: 320px;
          background:
            radial-gradient(circle at top, #16233b 0%, #0c1524 42%, #08101a 100%);
        }

        button, input, label {
          font: inherit;
        }

        .app {
          min-height: 100vh;
          padding: 20px 14px 30px;
        }

        .phone {
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
        }

        .title {
          margin: 0;
          text-align: center;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .subtitle {
          margin: 8px 0 18px;
          text-align: center;
          color: #9dafcf;
          font-size: 14px;
        }

        .card {
          background: rgba(17, 28, 46, 0.92);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
          padding: 16px;
          margin-bottom: 14px;
          box-shadow: 0 14px 30px rgba(0,0,0,0.22);
          backdrop-filter: blur(8px);
        }

        .topbar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }

        .icon-btn, .date-btn, .mini-btn, .main-btn, .ghost-btn, .danger-btn, .tab-btn, .file-label {
          border: 0;
          cursor: pointer;
          color: #edf3ff;
        }

        .icon-btn {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: #13233b;
          flex: 0 0 auto;
        }

        .date-btn {
          flex: 1;
          min-height: 42px;
          border-radius: 14px;
          background: #13233b;
          padding: 0 14px;
          font-weight: 700;
        }

        .section-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 12px;
        }

        .section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .muted {
          color: #9dafcf;
          font-size: 14px;
        }

        .calendar-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }

        .calendar-label {
          font-weight: 700;
          text-transform: capitalize;
        }

        .weekday-row, .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }

        .weekday {
          text-align: center;
          color: #8fa5ca;
          font-size: 12px;
          padding: 4px 0;
        }

        .day-cell {
          height: 46px;
          border-radius: 14px;
          border: 0;
          background: #101b2f;
          color: #edf3ff;
          position: relative;
          cursor: pointer;
        }

        .day-cell:hover {
          background: #152641;
        }

        .day-cell.selected {
          background: linear-gradient(135deg, #4b8bff, #6a5ffc);
        }

        .day-cell.today {
          outline: 2px solid rgba(125, 157, 220, 0.45);
        }

        .day-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          position: absolute;
          left: 50%;
          bottom: 7px;
          transform: translateX(-50%);
          background: #8ea5cd;
        }

        .day-cell.selected .day-dot {
          background: white;
        }

        .progress {
          width: 100%;
          height: 12px;
          border-radius: 999px;
          overflow: hidden;
          background: #101b2f;
        }

        .progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #4cc9f0, #4895ef);
        }

        .water-meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
          color: #9dafcf;
          font-size: 14px;
        }

        .chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .mini-btn {
          background: #16243d;
          border-radius: 12px;
          padding: 10px 12px;
        }

        .mini-btn:hover {
          background: #1b2d4b;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 14px;
        }

        .stat-card {
          background: rgba(17, 28, 46, 0.92);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 14px 30px rgba(0,0,0,0.18);
        }

        .stat-label {
          color: #9dafcf;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 800;
          line-height: 1;
        }

        .stat-goal {
          margin-top: 10px;
          color: #8fa5ca;
          font-size: 12px;
        }

        .action-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }

        .main-btn, .file-label {
          width: 100%;
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 16px;
          border-radius: 16px;
          font-weight: 700;
          background: linear-gradient(135deg, #4f8cff, #6d5dfc);
        }

        .ghost-btn {
          width: 100%;
          min-height: 54px;
          border-radius: 16px;
          background: #16243d;
          font-weight: 700;
        }

        .tab-btn {
          flex: 1;
          min-height: 44px;
          border-radius: 14px;
          background: #101b2f;
          font-weight: 700;
        }

        .tab-btn.active {
          background: linear-gradient(135deg, #4f8cff, #6d5dfc);
        }

        .tab-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .input {
          width: 100%;
          border: 0;
          outline: none;
          border-radius: 16px;
          padding: 14px 16px;
          background: #0f1a2d;
          color: white;
          font-size: 16px;
        }

        .input::placeholder {
          color: #7d91b8;
        }

        .message {
          margin-top: 10px;
          color: #a7b7d6;
          font-size: 14px;
        }

        .photo-preview {
          width: 100%;
          border-radius: 18px;
          margin-top: 12px;
          display: block;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .photo-placeholder {
          margin-top: 12px;
          border-radius: 18px;
          padding: 18px;
          background: #0f1a2d;
          color: #9dafcf;
          text-align: center;
          font-size: 14px;
        }

        .bmi-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .bmi-result {
          display: flex;
          align-items: stretch;
          gap: 12px;
          flex-wrap: wrap;
        }

        .bmi-box {
          flex: 1;
          min-width: 120px;
          background: #0f1a2d;
          border-radius: 16px;
          padding: 14px;
        }

        .bmi-big {
          font-size: 30px;
          font-weight: 800;
          line-height: 1;
          margin-top: 6px;
        }

        .empty {
          color: #9dafcf;
          background: #0f1a2d;
          border-radius: 16px;
          padding: 14px;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .list-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          background: #0f1a2d;
          border-radius: 16px;
          padding: 12px;
        }

        .item-title {
          font-weight: 700;
          margin-bottom: 4px;
          text-transform: capitalize;
        }

        .item-sub {
          color: #9dafcf;
          font-size: 14px;
          line-height: 1.4;
        }

        .delete-btn {
          border: 0;
          background: transparent;
          color: #ff8686;
          cursor: pointer;
          font-size: 18px;
        }

        .danger-btn {
          background: transparent;
          color: #ff8e8e;
          padding: 0;
          font-weight: 700;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          color: #9dafcf;
          font-size: 13px;
        }

        .field input {
          width: 100%;
          border: 0;
          outline: none;
          border-radius: 14px;
          padding: 12px 14px;
          background: #0f1a2d;
          color: white;
        }

        .file-input {
          display: none;
        }

        @media (max-width: 480px) {
          .title {
            font-size: 28px;
          }

          .water-meta {
            flex-direction: column;
          }

          .stat-value {
            font-size: 24px;
          }

          .settings-grid, .bmi-grid, .grid, .action-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <div className="app">
        <div className="phone">
          <h1 className="title">БЖУ трекер v2</h1>
          <p className="subtitle">Карточки, календарь, BMI, вода и добавление еды</p>

          <div className="topbar">
            <button
              className="icon-btn"
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            >
              ←
            </button>
            <button className="date-btn">{formatDateLabel(selectedDate)}</button>
            <button
              className="icon-btn"
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            >
              →
            </button>
          </div>

          <div className="card">
            <div className="calendar-nav">
              <button
                className="icon-btn"
                onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}
              >
                ←
              </button>
              <div className="calendar-label">{monthData.label}</div>
              <button
                className="icon-btn"
                onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}
              >
                →
              </button>
            </div>

            <div className="weekday-row">
              {weekDays.map((day) => (
                <div key={day} className="weekday">
                  {day}
                </div>
              ))}
            </div>

            <div className="calendar-grid">
              {monthData.cells.map((cell, index) =>
                cell ? (
                  <button
                    key={cell}
                    className={[
                      "day-cell",
                      cell === selectedDate ? "selected" : "",
                      cell === todayKey() ? "today" : "",
                    ]
                      .join(" ")
                      .trim()}
                    onClick={() => setSelectedDate(cell)}
                  >
                    {new Date(cell + "T12:00:00").getDate()}
                    {(entriesByDate[cell]?.length || 0) > 0 && (
                      <span className="day-dot" />
                    )}
                  </button>
                ) : (
                  <div key={index} />
                )
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-head">
              <div className="section-title">💧 Вода</div>
              <div className="muted">{round1(totals.water / 1000)} л</div>
            </div>

            <div className="progress">
              <div
                className="progress-fill"
                style={{ width: `${waterPercent}%` }}
              />
            </div>

            <div className="water-meta">
              <span>Цель: {round1(settings.waterGoal / 1000)} л</span>
              <span>
                Осталось: {Math.max(0, round1((settings.waterGoal - totals.water) / 1000))} л
              </span>
            </div>

            <div className="chip-row">
              <button className="mini-btn" onClick={() => addQuickWater(250)}>
                +250 мл
              </button>
              <button className="mini-btn" onClick={() => addQuickWater(500)}>
                +500 мл
              </button>
              <button className="mini-btn" onClick={() => addQuickWater(1000)}>
                +1 л
              </button>
            </div>
          </div>

          <div className="grid">
            {statCards.map((card) => (
              <div key={card.title} className="stat-card">
                <div className="stat-label">{card.title}</div>
                <div className="stat-value">
                  {card.value} <span style={{ fontSize: 14 }}>{card.unit}</span>
                </div>
                <div className="stat-goal">
                  Цель: {card.goal} {card.unit}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-title">Добавить еду</div>

            <div className="action-grid">
              <label className="file-label">
                📷 Фото еды
                <input
                  className="file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onPhotoSelected}
                />
              </label>

              <button
                className="ghost-btn"
                onClick={() => setShowManualInput((prev) => !prev)}
              >
                ✏️ Ввести вручную
              </button>
            </div>

            {photoPreview ? (
              <>
                <img src={photoPreview} alt="Фото еды" className="photo-preview" />
                {photoMessage ? <div className="message">{photoMessage}</div> : null}
              </>
            ) : (
              <div className="photo-placeholder">
                Здесь будет превью фото. Позже сюда можно подключить AI-разбор еды.
              </div>
            )}

            <div className="tab-row" style={{ marginTop: 12 }}>
              <button
                className={`tab-btn ${showManualInput ? "active" : ""}`}
                onClick={() => setShowManualInput(true)}
              >
                Ручной ввод
              </button>
              <button
                className={`tab-btn ${!showManualInput ? "active" : ""}`}
                onClick={() => setShowManualInput(false)}
              >
                Подсказки
              </button>
            </div>

            {showManualInput ? (
              <>
                <input
                  className="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addEntry()}
                  placeholder="Например: 1 банан, 2 яйца, 150 рис, 300 вода"
                />
                <button className="main-btn" onClick={addEntry} style={{ marginTop: 12 }}>
                  Добавить запись
                </button>
              </>
            ) : (
              <div className="chip-row" style={{ marginTop: 0 }}>
                {[
                  "1 банан",
                  "2 яйца",
                  "150 рис",
                  "200 молоко",
                  "300 вода",
                  "1 яблоко",
                ].map((hint) => (
                  <button
                    key={hint}
                    className="mini-btn"
                    onClick={() => {
                      setInput(hint);
                      setShowManualInput(true);
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}

            {message ? <div className="message">{message}</div> : null}
          </div>

          <div className="card">
            <div className="section-title">⚖️ BMI калькулятор</div>

            <div className="bmi-grid">
              <div className="field">
                <label>Рост (см)</label>
                <input
                  type="number"
                  value={bmiData.height}
                  onChange={(e) => updateBmiField("height", e.target.value)}
                />
              </div>

              <div className="field">
                <label>Вес (кг)</label>
                <input
                  type="number"
                  value={bmiData.weight}
                  onChange={(e) => updateBmiField("weight", e.target.value)}
                />
              </div>
            </div>

            <div className="bmi-result">
              <div className="bmi-box">
                <div className="stat-label">BMI</div>
                <div className="bmi-big">
                  {bmiValue ? round1(bmiValue) : "—"}
                </div>
              </div>

              <div className="bmi-box">
                <div className="stat-label">Категория</div>
                <div className="bmi-big" style={{ fontSize: 22 }}>
                  {getBmiCategory(bmiValue)}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-head">
              <div className="section-title" style={{ margin: 0 }}>
                Записи за день
              </div>
              <button className="danger-btn" onClick={clearDay}>
                Очистить день
              </button>
            </div>

            {dayEntries.length === 0 ? (
              <div className="empty">Пока пусто. Добавь еду, воду или фото выше.</div>
            ) : (
              <div className="list">
                {dayEntries.map((item) => (
                  <div key={item.id} className="list-item">
                    <div>
                      <div className="item-title">{item.label}</div>
                      {item.type === "food" ? (
                        <div className="item-sub">
                          Б {item.macros.p} · Ж {item.macros.f} · У {item.macros.c} ·{" "}
                          {item.macros.kcal} ккал
                        </div>
                      ) : (
                        <div className="item-sub">Вода: {item.quantity} мл</div>
                      )}
                    </div>

                    <button className="delete-btn" onClick={() => removeEntry(item.id)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">Цели</div>

            <div className="settings-grid">
              <div className="field">
                <label>Белки (г)</label>
                <input
                  type="number"
                  value={settings.proteinGoal}
                  onChange={(e) => updateSetting("proteinGoal", e.target.value)}
                />
              </div>

              <div className="field">
                <label>Жиры (г)</label>
                <input
                  type="number"
                  value={settings.fatGoal}
                  onChange={(e) => updateSetting("fatGoal", e.target.value)}
                />
              </div>

              <div className="field">
                <label>Углеводы (г)</label>
                <input
                  type="number"
                  value={settings.carbsGoal}
                  onChange={(e) => updateSetting("carbsGoal", e.target.value)}
                />
              </div>

              <div className="field">
                <label>Калории</label>
                <input
                  type="number"
                  value={settings.caloriesGoal}
                  onChange={(e) => updateSetting("caloriesGoal", e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Вода (мл)</label>
                <input
                  type="number"
                  value={settings.waterGoal}
                  onChange={(e) => updateSetting("waterGoal", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;