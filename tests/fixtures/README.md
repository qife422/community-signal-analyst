# 测试夹具

whop-snapshot.json、whop-scope.json、public-brief.json 全部是为可恢复仓库编造的离线输入，不包含真实成员频道或发言，不构成线上验收证据。47条Whop记录只用于保持增量/重复处理测试形状。

public-brief 使用 `isMockData:false` 和 `sourceStatus:verified_api` 模拟已有真实研究报告的输入schema，因为重筛入口拒绝mock报告；这些是测试刺激，不表示真实来源已经采集。fixtureProvenance、正文、标题和限制明确标注synthetic。所有测试运行必须保持平台请求mock/禁止网络。

原来的本机历史验收材料留在 artifacts 中，不上传为测试数据，不改写为新夹具，也不参与恢复后的回归。
