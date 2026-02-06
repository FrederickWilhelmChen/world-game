using Godot;
using System.Collections.Generic;
using GrandStrategyGame.Map;

namespace GrandStrategyGame.Map
{
    public class Province
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public TerrainType Terrain { get; set; }
        public Vector2I[] Cells { get; set; }
        public Vector2 Centroid { get; set; }
        public int CountryId { get; set; } = -1;
        public int Development { get; set; } = 1;
        public List<int> Neighbors { get; set; } = new List<int>();
        public bool IsCoastal { get; set; }
        public bool HasRiver { get; set; }
        public float Fortification { get; set; }
        
        // 渲染相关
        public Polygon2D RenderPolygon { get; set; }
        public Color BaseColor { get; set; }
        
        public Province(int id)
        {
            Id = id;
            Name = $"Province_{id}";
            Cells = System.Array.Empty<Vector2I>();
        }
        
        public void CalculateCentroid()
        {
            if (Cells == null || Cells.Length == 0) return;
            
            Vector2 sum = Vector2.Zero;
            foreach (var cell in Cells)
            {
                sum += new Vector2(cell.X, cell.Y);
            }
            Centroid = sum / Cells.Length;
        }
    }
}
