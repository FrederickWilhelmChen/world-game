using Godot;
using System.Collections.Generic;

namespace GrandStrategyGame.Map
{
    public partial class MapRenderer : Node2D
    {
        [Export] public Color OceanColor { get; set; } = new Color(0.2f, 0.4f, 0.7f);
        [Export] public Color RiverColor { get; set; } = new Color(0.3f, 0.6f, 0.9f);
        [Export] public Color BorderColor { get; set; } = new Color(0.1f, 0.1f, 0.1f, 0.5f);
        [Export] public float BorderWidth { get; set; } = 1.0f;
        
        private TileMapLayer _terrainLayer;
        private Node2D _provinceHighlightLayer;
        private Node2D _borderLayer;
        
        public override void _Ready()
        {
            CreateLayers();
            RenderMap();
        }
        
        private void CreateLayers()
        {
            // 创建TileMap层用于地形
            _terrainLayer = new TileMapLayer();
            _terrainLayer.Name = "Terrain";
            _terrainLayer.TileSet = CreateTileSet();
            AddChild(_terrainLayer);
            
            // 高亮层
            _provinceHighlightLayer = new Node2D { Name = "Highlights" };
            AddChild(_provinceHighlightLayer);
            
            // 边界层
            _borderLayer = new Node2D { Name = "Borders" };
            AddChild(_borderLayer);
        }
        
        private TileSet CreateTileSet()
        {
            var tileSet = new TileSet();
            tileSet.TileSize = new Vector2I(MapData.CELL_SIZE, MapData.CELL_SIZE);
            
            // 创建地形源
            var terrainSource = new TileSetAtlasSource();
            terrainSource.Texture = CreateTerrainTexture();
            terrainSource.TextureRegionSize = new Vector2I(MapData.CELL_SIZE, MapData.CELL_SIZE);
            
            // 添加不同颜色的图块
            terrainSource.CreateTile(new Vector2I(0, 0)); // 平原 - 绿色
            terrainSource.CreateTile(new Vector2I(1, 0)); // 丘陵 - 黄绿
            terrainSource.CreateTile(new Vector2I(2, 0)); // 山地 - 棕色
            terrainSource.CreateTile(new Vector2I(3, 0)); // 森林 - 深绿
            terrainSource.CreateTile(new Vector2I(4, 0)); // 沙漠 - 黄色
            terrainSource.CreateTile(new Vector2I(5, 0)); // 海岸 - 浅绿
            terrainSource.CreateTile(new Vector2I(6, 0)); // 河流 - 蓝色
            terrainSource.CreateTile(new Vector2I(7, 0)); // 海洋 - 深蓝
            
            tileSet.AddSource(terrainSource, 0);
            
            return tileSet;
        }
        
        private ImageTexture CreateTerrainTexture()
        {
            // 创建一个包含所有地形颜色的纹理图集
            int tileSize = MapData.CELL_SIZE;
            int atlasWidth = 8 * tileSize; // 8种地形
            int atlasHeight = tileSize;
            
            var image = Image.CreateEmpty(atlasWidth, atlasHeight, false, Image.Format.Rgba8);
            
            // 填充颜色
            Color[] terrainColors = new Color[]
            {
                new Color(0.4f, 0.7f, 0.3f), // 平原 - 绿色
                new Color(0.7f, 0.7f, 0.4f), // 丘陵 - 黄绿
                new Color(0.6f, 0.5f, 0.4f), // 山地 - 棕色
                new Color(0.2f, 0.5f, 0.2f), // 森林 - 深绿
                new Color(0.9f, 0.8f, 0.5f), // 沙漠 - 黄色
                new Color(0.5f, 0.7f, 0.4f), // 海岸 - 浅绿
                new Color(0.3f, 0.6f, 0.9f), // 河流 - 蓝色
                new Color(0.2f, 0.4f, 0.7f), // 海洋 - 深蓝
            };
            
            for (int i = 0; i < 8; i++)
            {
                for (int x = 0; x < tileSize; x++)
                {
                    for (int y = 0; y < tileSize; y++)
                    {
                        image.SetPixel(i * tileSize + x, y, terrainColors[i]);
                    }
                }
            }
            
            return ImageTexture.CreateFromImage(image);
        }
        
        public void RenderMap()
        {
            ClearMap();
            RenderTerrain();
            RenderProvinceOverlays();
            RenderBorders();
        }
        
        private void ClearMap()
        {
            _terrainLayer.Clear();
            foreach (Node child in _provinceHighlightLayer.GetChildren())
                child.QueueFree();
            foreach (Node child in _borderLayer.GetChildren())
                child.QueueFree();
        }
        
        private void RenderTerrain()
        {
            // 使用TileMap渲染基础地形
            for (int x = 0; x < MapData.MAP_WIDTH; x++)
            {
                for (int y = 0; y < MapData.MAP_HEIGHT; y++)
                {
                    int terrainType = MapData.Instance.TerrainGrid[x, y];
                    Vector2I atlasCoords = new Vector2I(terrainType, 0);
                    _terrainLayer.SetCell(new Vector2I(x, y), 0, atlasCoords);
                }
            }
        }
        
        private void RenderProvinceOverlays()
        {
            // 为国家添加半透明覆盖层
            for (int i = 0; i < MapData.PROVINCE_COUNT; i++)
            {
                var province = MapData.Instance.Provinces[i];
                if (province.Cells.Length == 0) continue;
                if (province.CountryId < 0 || province.CountryId >= MapData.COUNTRY_COUNT) continue;
                
                var country = MapData.Instance.Countries[province.CountryId];
                
                // 为每个省份格子创建彩色覆盖
                foreach (var cell in province.Cells)
                {
                    // 在格子上方绘制一个半透明的色块表示国家归属
                    var colorRect = new ColorRect();
                    colorRect.Color = new Color(country.Color.R, country.Color.G, country.Color.B, 0.4f);
                    colorRect.Position = new Vector2(cell.X * MapData.CELL_SIZE, cell.Y * MapData.CELL_SIZE);
                    colorRect.Size = new Vector2(MapData.CELL_SIZE, MapData.CELL_SIZE);
                    colorRect.Name = $"Province_{i}_Cell_{cell.X}_{cell.Y}";
                    _provinceHighlightLayer.AddChild(colorRect);
                    
                    // 保存引用以便高亮
                    if (province.RenderPolygon == null)
                    {
                        province.RenderPolygon = new Polygon2D(); // 用作标记
                    }
                }
            }
        }
        
        private void RenderBorders()
        {
            // 简化边界渲染 - 只在国家之间绘制粗线
            var drawnBorders = new HashSet<(int, int)>();
            
            for (int i = 0; i < MapData.PROVINCE_COUNT; i++)
            {
                var province = MapData.Instance.Provinces[i];
                if (province.Cells.Length == 0) continue;
                
                foreach (var neighborId in province.Neighbors)
                {
                    if (neighborId <= i) continue; // 避免重复
                    
                    var neighbor = MapData.Instance.Provinces[neighborId];
                    
                    // 只绘制国家边界
                    if (province.CountryId != neighbor.CountryId)
                    {
                        var borderKey = (i, neighborId);
                        if (!drawnBorders.Contains(borderKey))
                        {
                            DrawBorderLine(province, neighbor, new Color(0, 0, 0, 0.6f), 2.0f);
                            drawnBorders.Add(borderKey);
                        }
                    }
                }
            }
        }
        
        private void DrawBorderLine(Province a, Province b, Color color, float width)
        {
            // 找到两个省份的中心点，绘制连接线
            Vector2 start = a.Centroid * MapData.CELL_SIZE + new Vector2(MapData.CELL_SIZE / 2f, MapData.CELL_SIZE / 2f);
            Vector2 end = b.Centroid * MapData.CELL_SIZE + new Vector2(MapData.CELL_SIZE / 2f, MapData.CELL_SIZE / 2f);
            
            var line = new Line2D();
            line.Points = new[] { start, end };
            line.DefaultColor = color;
            line.Width = width;
            _borderLayer.AddChild(line);
        }
        
        public void UpdateProvinceColor(Province province)
        {
            // 此方法在新实现中不需要，因为颜色在RenderProvinceOverlays中设置
        }
        
        public void HighlightProvince(int provinceId, Color color)
        {
            if (provinceId < 0 || provinceId >= MapData.PROVINCE_COUNT) return;
            
            var province = MapData.Instance.Provinces[provinceId];
            if (province.Cells.Length == 0) return;
            
            // 移除之前的高亮
            ResetProvinceColor(provinceId);
            
            // 添加高亮覆盖层
            foreach (var cell in province.Cells)
            {
                var highlight = new ColorRect();
                highlight.Color = color;
                highlight.Position = new Vector2(cell.X * MapData.CELL_SIZE, cell.Y * MapData.CELL_SIZE);
                highlight.Size = new Vector2(MapData.CELL_SIZE, MapData.CELL_SIZE);
                highlight.Name = $"Highlight_{provinceId}";
                _provinceHighlightLayer.AddChild(highlight);
            }
        }
        
        public void ResetProvinceColor(int provinceId)
        {
            if (provinceId < 0 || provinceId >= MapData.PROVINCE_COUNT) return;
            
            // 移除高亮节点
            foreach (Node child in _provinceHighlightLayer.GetChildren())
            {
                if (child.Name.ToString().StartsWith($"Highlight_{provinceId}"))
                {
                    child.QueueFree();
                }
            }
        }
    }
}
