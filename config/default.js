const config = {
    app: {
        secret: '[1)07T]z@qIærOG$WFDV$%^$%YHRSTh45y5gf<j@L6};ZBÄs_î;ü0=QpC[µðo}&(&({:&UY',
        port: parseInt(process.env.APP_PORT, 10) || 3000,
    },
    db: {
        host: process.env.MYSQL_HOST,
        database: process.env.MYSQL_DATABASE,
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        dialect: 'mysql',
        port: 3306,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: false
    },
    project: 'token_alert_bot',
    frontendBaseUrl: process.env.FRONTEND_BASE_URL,
    RESET_PASSWORD_EXPIRATION: 10, // minutes

    enabledCron: process.env.ENABLED_CRON || 1,
    cronFilterInterval: process.env.CRON_FILTER_INTERVAL || '*/11 * * * * *',
    cronFetchPoolInterval: process.env.CRON_FETCH_POOL_INTERVAL || '*/15 * * * * *',
    cronUpdatePoolInterval: process.env.CRON_UPDATE_POOL_INTERVAL || '*/10 * * * * *',
    cronMonitorInterval: process.env.CRON_MONITOR_INTERVAL || '*/11 * * * * *',

    web3Provider: process.env.WEB3_PROVIDER,

    uniV2FactoryEventBlock: process.env.EVENT_BLOCK || 0,
    maxCollectionCapacity: process.env.MAX_COLLECTION_CAPACITY || 500,

    uniswapV3Router2Address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    usdtAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    daiAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
    uniswapV2FactoryAddress: process.env.UNISWAPV2_FACTORY_CONTRACT_ADDRESS,
    sushiswapFactoryAddress: process.env.SUSHISWAP_FACTORY_CONTRACT_ADDRESS,
    uniswapV2RouterAddress: process.env.UNISWAPV2_ROUTER_CONTRACT_ADDRESS,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChannelID: process.env.TELEGRAM_CHANNEL_ID,
    telegramBuyBotToken: process.env.TELEGRAM_BUY_BOT_TOKEN,
    telegramBuyChannelId:process.env.TELEGRAM_BUY_CHANNEL_ID,
    telegramTestBotToken:process.env.TELEGRAM_TEST_BOT_TOKEN,
    telegramTestChannelId:process.env.TELEGRAM_TEST_CHANNEL_ID,
    
    timeLimit: process.env.TIME_LIMIT,
    minHolderCount: process.env.MIN_HOLDER_COUNT,
    minInitPool: process.env.MIN_INIT_POOL,

    etherscanAPIKey: process.env.ETHERSCAN_KEY,
    blocknativeAPIKey: process.env.BLOCKNATIVE_Key,
    blocknativeAPIKeyForTest: process.env.BLOCKNATIVE_TEST__Key,
    N_WALLET: process.env.N_WALLET
};

module.exports = config;
