const sqlite3 = require('sqlite3').verbose();

const DB_PATH = '../pooldata.db';

const dbqurey =
`

-- pool Table Create SQL
CREATE TABLE pool
(
  id varchar(45) not null,
  token0 varchar(10) not null,
  token1 varchar(10) not null,
  feeTier INTEGER not null,
  createdAtBlockNumber INTEGER not null,
  PRIMARY KEY (id)
);

-- pre-pool Table Create SQL
CREATE TABLE pre-pool
(
  id varchar(45) not null REFERENCES pool(id) ON DELETE RESTRICT,
  blockNumber INTEGER not null,
  feeGrowthGlobal0x128 not null,
  feeGrowthGlobal1x128 not null,
  sqrtPrice varchar(45) not null,
  tick INTEGER not null,
  PRIMARY KEY (blockNumber),
);

CREATE UNIQUE INDEX UQ_pre-pool_1
    ON pre-pool(blockNumber);


-- ticks Table Create SQL
CREATE TABLE ticks
(
  tickIdx INT not null,
  liquidityGross varchar(45) not null,
  feeGrowthOutside0X128 varchar(45) not null,
  feeGrowthOutside1X128 varchar(45) not null,
  ID varchar(45) not null REFERENCES pre-pool(id) ON DELETE RESTRICT,
  blockNumber INTEGER not null REFERENCES pre-pool(blockNumber),
);
`

// open database in memory
let db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the chinook database.');
})

db.serialize(() => {
  db.run(dbqurey)
  .run(`INSERT INTO pool(id, token0, token1, feeTier, createdAtBlockNumber) VALUES("1234", "weth", "uni", 3000, 5991);`)
});


// close the database connection
db.close((err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Close the database connection.');
});