// Přidání nového dashboardu = jeden objekt níže + jeden nový .astro soubor v src/pages/dashboardy/
export interface Dashboard {
  title: string;
  description: string;
  tags: string[];
  url: string;
  featured?: boolean;
}

export const dashboards: Dashboard[] = [
  {
    title: "Jak je na tom Ostrava",
    description:
      "Interaktivní Power BI report: obyvatelé, bezpečnost, ovzduší od 90. let, práce, školy a mapa města.",
    tags: ["Ostrava", "Power BI", "Mapa"],
    url: "/dashboardy/ostrava-report",
    featured: true,
  },
  {
    title: "Rozpočet Ostravy",
    description:
      "Kolik magistrát a obvody plánovaly a kolik skutečně utratily. Podle oblastí a let.",
    tags: ["Ostrava", "CityVizor", "Rozpočet"],
    url: "/dashboardy/ostrava-rozpocet",
    featured: true,
  },
  {
    title: "Investiční akce Ostravy",
    description:
      "Akce města, jejich rozpočet, čerpání a dodavatelé. Včetně VOX.",
    tags: ["Ostrava", "Akce", "Dodavatelé"],
    url: "/dashboardy/ostrava-akce",
    featured: true,
  },
  {
    title: "Hlasování zastupitelstva Ostravy",
    description:
      "Jak zastupitelstvo hlasovalo o akcích, rozdělené podle kandidátních listin.",
    tags: ["Ostrava", "Zastupitelstvo", "Hlasování"],
    url: "/dashboardy/ostrava-hlasovani",
    featured: true,
  },
  {
    title: "Trading Backtest",
    description:
      "SMA crossover strategie na EUR/USD: equity curve, drawdown, měsíční PnL.",
    tags: ["EUR/USD", "Backtest", "SMA"],
    url: "/dashboardy/trading-backtest",
  },
];

export const DATA_BASE_URL = "https://data.jakubvozar.cz";
