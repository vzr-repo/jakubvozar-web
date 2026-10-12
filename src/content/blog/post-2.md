---
title: "Python, yfinance a můj první backtest: jak jsem otestoval SMA strategii na EUR/USD"
meta_title: ""
description: "Stažení dat přes yfinance, uložení do Parquet, SMA crossover backtest a co výsledky odhalily o komisionářských nákladech."
date: 2026-05-01T23:00:00Z
image: "/images/Post-2.png"
categories: ["Data Engineering", "Trading"]
author: "Jakub Vozar"
tags: ["python", "yfinance", "backtesting", "parquet", "trading"]
draft: false
---

> 💡 **TL;DR:** Prvním krokem do Data Engineeringu byl Python — stažení forex dat přes yfinance, uložení do Parquet souboru a první backtest SMA crossover strategie. Výsledky byly... poučné.

## Python jako první nástroj Data Engineera

Rozhodnutí bylo jasné: začínám Pythonem. Proč? Protože Python je lingua franca datového světa — má obrovskou komunitu, nekonečné množství knihoven pro práci s daty a je to jazyk, který potkáš v každém DE job postu. Setkal jsem se s ním i dříve, ale nikdy jsem nestál před takovým úkolem, jaký jsem si teď naložil.

Mentor v tomto projektu mi byl Claude — ale s jasným pravidlem: **nechci, aby psal kód za mě. Chci, abych mu rozuměl.** Každý krok nejdřív vysvětlit vlastními slovy, pak teprve kódovat. Pomalu, ale s hlavou.

## yfinance: data zdarma, bez registrace, bez API klíče

Prvním úkolem bylo sehnat data. Rozhodl jsem se pro **yfinance** — Python wrapper nad Yahoo Finance. Žádná registrace, žádný API klíč, žádné rate limity. Stačí `pip install yfinance` a máš přístup k historickým datům akcií, ETF i forexových párů zpět o 5+ let.

Pro první experiment jsem zvolil EUR/USD na hodinových svíčkách za rok 2025:

```python
import pandas as pd
import yfinance as yf
from datetime import datetime
import os

os.makedirs("data", exist_ok=True)

start_date = datetime(2025, 1, 1)
end_date = datetime(2025, 12, 31)

df = yf.download(
    tickers="EURUSD=X",
    interval="1h",
    start=start_date,
    end=end_date
)

print(df.shape)
print(df.head())

try:
    df.to_parquet("data/EURUSD_1H.parquet")
    print("Uloženo!")
except Exception as e:
    print(f"Chyba: {type(e).__name__}: {e}")
```

Pár řádků kódu a máš tisíce řádků čistých OHLCV dat na disku. To byl ten moment, kdy mi Data Engineering začal dávat smysl.

## Parquet místo CSV: proč ne Excel

Data ukládám do **Parquet** souboru, ne do CSV nebo Excelu. Proč? Parquet je sloupcový formát — ukládá data po sloupcích, ne po řádcích. Pro analytické dotazy (kde čteš jeden sloupec přes milion řádků) je to řádově rychlejší a výsledný soubor je menší díky vestavěné kompresi.

CSV je skvělé pro sdílení a debugging — přečteš ho v poznámkovém bloku. Parquet je skvělé pro pipeline — čteš ho Pythonem, Sparkem, nebo dotazuješ přes AWS Athena. AWS a Spark jsou Parquet-native. Byl to první krok od "ukládám soubory" k "buduji datový systém".

## Backtest SMA crossover strategie

S daty na disku přišel první skutečný úkol: **otestovat SMA crossover strategii** pomocí knihovny `backtesting.py`. SMA crossover je klasika — kupuješ, když kratší klouzavý průměr překříží delší zdola, a prodáváš při opačném průsečíku.

```python
import pandas as pd
from backtesting import Backtest, Strategy
from backtesting.lib import crossover

df = pd.read_parquet("data/eurusd_1h.parquet")
df.columns = df.columns.droplevel(1)
df.index = df.index.tz_localize(None)

def sma(arr, n):
    return pd.Series(arr).rolling(n).mean()

class SmaCross(Strategy):
    n1 = 20  # kratší SMA
    n2 = 50  # delší SMA

    def init(self):
        self.sma1 = self.I(sma, self.data.Close, self.n1)
        self.sma2 = self.I(sma, self.data.Close, self.n2)

    def next(self):
        if crossover(self.sma1, self.sma2):
            self.buy()
        if crossover(self.sma2, self.sma1):
            self.sell()

bt = Backtest(df, SmaCross, cash=10000, commission=0.0002, exclusive_orders=True)
stats = bt.run()

# Export výsledků
stats._trades.to_csv("data/trades.csv")
stats._equity_curve.to_csv("data/equity_curve.csv")
pd.Series(stats).to_csv("data/stats.csv")
```

Výsledky se exportují do CSV a pak je vizualizuji přes Plotly — interaktivní equity curve, drawdown chart a tabulka obchodů jsou embedded přímo na webu.

## Co backtest ukázal

Výsledky byly… poučné. SMA crossover na hodinových datech EUR/USD sice generoval signály, ale **komisionářské náklady ho drtily**. Každý obchod stál 0.02 % — a při desítkách obchodů měsíčně se to sečte. Strategie, která vypadá skvěle bez poplatků, může být ve skutečnosti ztrátová.

To je přesně důvod, proč backtesting existuje — ne aby ti řekl, co obchodovat, ale aby tě konfrontoval s realitou dřív, než vložíš skutečné peníze. Brokeři velmi rádi propagují podobné strategie právě proto, že generují hodně obchodů a tím pádem hodně poplatků — pro ně.

Dashboard s výsledky si můžeš prohlédnout zde → [Trading Backtest Dashboard](/dashboardy/trading-backtest)

## Co přijde dál

Příští krok: rozšíření z jednoho forex páru na 15 akciových titulů napříč třemi sektory. A tam jsem narazil na API limit, který změnil celý přístup k ingestu dat. O tom v dalším postu.
