using Godot;
using System.Collections.Generic;

namespace GrandStrategyGame.Map
{
    public enum TerrainType
    {
        Plains,      // 平原 - 农业基础地形
        Hills,       // 丘陵 - 采矿加成
        Mountains,   // 山地 - 防御加成，移动惩罚
        Forest,      // 森林 - 木材产出，视野限制
        Desert,      // 沙漠 - 发展度惩罚
        Coastal,     // 海岸 - 港口建设，渔业
        River,       // 河流 - 贸易路线，穿越惩罚
        Ocean        // 海洋
    }

    public enum GovernmentType
    {
        AbsoluteMonarchy,
        ConstitutionalMonarchy,
        PresidentialRepublic,
        ParliamentaryRepublic
    }

    public enum ResourceType
    {
        Grain,
        Wood,
        IronOre,
        Coal,
        Oil,
        CopperOre,
        Bauxite,
        PreciousMetal,
        Fish
    }

    public enum PopType
    {
        Peasant,
        Laborer,
        Machinist,
        Clerk,
        Soldier,
        Aristocrat,
        Capitalist,
        Bureaucrat
    }
}
