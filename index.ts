import { exec } from "child_process";
import { readFileSync } from "fs";
import * as https from "https";

//#region Interfaces & Types
interface HomeAssistantAPIInfo {
    host: string;
    port: number;
    token: string;
}
interface ZFSMonitorConfig {
    pool_list: string[];
    has: HomeAssistantAPIInfo;
}
interface ZFSPoolInfo {
    status: string;
    usage: string;
    capacity: string;
    used: string;
    available: string;
}
type ZFSPoolInfoProps = "status" | "usage" | "capacity" | "used" | "available";
//#endregion

//#region Global Variables
let poolInfoUnitMapping = {
    status: "",
    usage: "%",
    capacity: "TB",
    used: "TB",
    available: "TB"
}
const config: ZFSMonitorConfig = JSON.parse(readFileSync("./config.json", "utf-8"));
//#endregion

//#region Home Assistant API Integration
const postPoolStatus = (poolName: string, poolInfo: ZFSPoolInfo) => {
    for (let item of Object.keys(poolInfo)){
        var req = https.request({
            method: "POST",
            host: config.has.host,
            port: config.has.port,
            path: `/api/states/sensor.zfs_pool_${poolName}_${item}`,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.has.token}`
            }
        }, function (res) {
            var chunks: any = [];
    
            res.on("data", function (chunk) {
                chunks.push(chunk);
            });    
            res.on("end", function (chunk: any) {});    
            res.on("error", function (error) {});
        });
    
        var postData = JSON.stringify({
            "state": poolInfo[item as ZFSPoolInfoProps],
            "attributes": {
                "unit_of_measurement": poolInfoUnitMapping[item as ZFSPoolInfoProps],
                "friendly_name": `ZFS Pool ${poolName} ${item}`
            }
        });
        req.write(postData);
        req.end();
    }
}
//#endregion

//#region ZFS Pool Integration
let pools: ZFSPoolInfo[] = [];
const monitorPools = () => {
    for (let pool of config.pool_list) {
        exec(`zpool list -H ${pool}`, (err, stdout, stderr) => {
            if (err) {
                throw err;
            }
            const parts = stdout.split("\t");
            console.log(`Processed ${pool}.`);        
            postPoolStatus(pool, {
                capacity: parts[1].replace("T", ""),
                used: parts[2].replace("T", ""),
                available: parts[3].replace("T", ""),
                usage: parts[7].replace("%", ""),
                status: parts[9]
            });
        });
    }
    setTimeout(() => {
        monitorPools();
    }, 1000 * 60);
}
monitorPools();
//#endregion