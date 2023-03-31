# 步骤
## 启动本地网络
```shell
sui genesis
RUST_LOG="consensus=off" sui start
```

## 修改代码
1. 设置packageObjectId,
用以下命令安装package，获得packageObjectId
```shell
sui client publish ~/sui/sui_programmability/examples/basics/ --gas-budget 10000
```

2. 设置gamePkgObjectId, stateObjectId
类似步骤1，安装 battleship game合约，获得上述id

3. 设置activeAddrKeystore,
在 ~/.sui/sui_config/sui.keystore 中查看与active address 对应的keysotre

4. 要确保项目根目录下存在从 BattleZips-Circom/zk/ 拷贝过来的zk目录, 该目录包含
   BattleZips-Circom 项目经yarn setup 之后生成的zk key等文件。

## 安装依赖
```shell
npm install
```

## 运行测试
```shell
ts-node index.ts
```
