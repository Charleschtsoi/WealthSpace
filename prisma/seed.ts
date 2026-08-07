import { PrismaClient, AccountType, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.transaction.deleteMany();
  await prisma.assetHolding.deleteMany();
  await prisma.netWorthSnapshot.deleteMany();
  await prisma.account.deleteMany();

  const hangSeng = await prisma.account.create({
    data: {
      name: "Hang Seng",
      type: AccountType.CASH,
      balance: 84250,
      currency: "USD",
    },
  });

  const firstrade = await prisma.account.create({
    data: {
      name: "Firstrade",
      type: AccountType.BROKERAGE,
      balance: 412800,
      currency: "USD",
    },
  });

  await prisma.account.create({
    data: {
      name: "Property — Kowloon",
      type: AccountType.REAL_ESTATE,
      balance: 920000,
      currency: "USD",
    },
  });

  await prisma.assetHolding.createMany({
    data: [
      {
        accountId: firstrade.id,
        ticker: "VOO",
        quantity: 220,
        averagePrice: 410.25,
        currentPrice: 528.4,
      },
      {
        accountId: firstrade.id,
        ticker: "VXUS",
        quantity: 480,
        averagePrice: 55.1,
        currentPrice: 62.35,
      },
      {
        accountId: firstrade.id,
        ticker: "NVDA",
        quantity: 95,
        averagePrice: 420,
        currentPrice: 118.75,
      },
      {
        accountId: firstrade.id,
        ticker: "META",
        quantity: 55,
        averagePrice: 310.5,
        currentPrice: 512.2,
      },
      {
        accountId: firstrade.id,
        ticker: "AAPL",
        quantity: 80,
        averagePrice: 165,
        currentPrice: 228.4,
      },
    ],
  });

  await prisma.transaction.createMany({
    data: [
      {
        accountId: hangSeng.id,
        type: TransactionType.DEPOSIT,
        amount: 12000,
        date: new Date("2026-08-02"),
        description: "Salary deposit",
      },
      {
        accountId: firstrade.id,
        type: TransactionType.BUY,
        amount: 2500,
        date: new Date("2026-08-01"),
        description: "BUY VOO",
      },
    ],
  });

  const snapshots = [
    [1000000, "2025-09-01"],
    [1037000, "2025-10-01"],
    [1066000, "2025-11-01"],
    [1114000, "2025-12-01"],
    [1138000, "2026-01-01"],
    [1125000, "2026-02-01"],
    [1180000, "2026-03-01"],
    [1206000, "2026-04-01"],
    [1235000, "2026-05-01"],
    [1253000, "2026-06-01"],
    [1242000, "2026-07-01"],
    [1259050, "2026-08-01"],
  ] as const;

  for (const [netWorth, date] of snapshots) {
    const liabilities = 160000;
    await prisma.netWorthSnapshot.create({
      data: {
        date: new Date(date),
        totalAssets: netWorth + liabilities,
        totalLiabilities: liabilities,
        netWorth,
      },
    });
  }

  console.log("WealthSpace seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
