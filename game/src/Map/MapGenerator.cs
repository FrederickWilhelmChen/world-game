using Godot;
using System;
using System.Collections.Generic;
using System.Linq;

namespace GrandStrategyGame.Map
{
    public partial class MapGenerator : Node
    {
        [Export] public int Seed { get; set; } = 12345;
        [Export] public float SeaLevel { get; set; } = -0.3f;
        [Export] public int RiverCount { get; set; } = 15;
        
        private FastNoiseLite _continentNoise;
        private FastNoiseLite _detailNoise;
        private FastNoiseLite _moistureNoise;
        private RandomNumberGenerator _rng;
        
        public override void _Ready()
        {
            GenerateMap(Seed);
        }
        
        public void GenerateMap(int seed)
        {
            Seed = seed;
            _rng = new RandomNumberGenerator();
            _rng.Seed = (uint)seed;
            
            // 初始化噪声生成器
            InitializeNoise();
            
            // 生成地形
            GenerateTerrain();
            
            // 生成省份
            GenerateProvinces();
            
            // 生成河流
            GenerateRivers();
            
            // 计算邻国
            CalculateNeighbors();
            
            // 分配国家
            AssignCountries();
            
            GD.Print($"Map generated with seed {seed}");
            GD.Print($"Provinces: {MapData.PROVINCE_COUNT}");
            GD.Print($"Countries: {MapData.COUNTRY_COUNT}");
        }
        
        private void InitializeNoise()
        {
            _continentNoise = new FastNoiseLite();
            _continentNoise.NoiseType = FastNoiseLite.NoiseTypeEnum.Simplex;
            _continentNoise.Seed = Seed;
            _continentNoise.Frequency = 0.01f;
            
            _detailNoise = new FastNoiseLite();
            _detailNoise.NoiseType = FastNoiseLite.NoiseTypeEnum.Simplex;
            _detailNoise.Seed = Seed + 1;
            _detailNoise.Frequency = 0.05f;
            
            _moistureNoise = new FastNoiseLite();
            _moistureNoise.NoiseType = FastNoiseLite.NoiseTypeEnum.Simplex;
            _moistureNoise.Seed = Seed + 2;
            _moistureNoise.Frequency = 0.03f;
        }
        
        private void GenerateTerrain()
        {
            for (int x = 0; x < MapData.MAP_WIDTH; x++)
            {
                for (int y = 0; y < MapData.MAP_HEIGHT; y++)
                {
                    TerrainType terrain = CalculateTerrainAt(x, y);
                    MapData.Instance.TerrainGrid[x, y] = (int)terrain;
                }
            }
        }
        
        private TerrainType CalculateTerrainAt(int x, int y)
        {
            float continent = _continentNoise.GetNoise2D(x, y);
            float detail = _detailNoise.GetNoise2D(x, y);
            float moisture = _moistureNoise.GetNoise2D(x + 1000, y + 1000);
            
            // 海洋
            if (continent < SeaLevel)
                return TerrainType.Ocean;
            
            // 海岸
            if (continent < SeaLevel + 0.1f)
                return TerrainType.Coastal;
            
            // 山脉
            if (continent > 0.5f && detail > 0.4f)
                return TerrainType.Mountains;
            
            // 丘陵
            if (detail > 0.2f)
                return TerrainType.Hills;
            
            // 森林
            if (moisture > 0.3f && continent > 0)
                return TerrainType.Forest;
            
            // 沙漠
            if (moisture < -0.5f && continent > 0)
                return TerrainType.Desert;
            
            return TerrainType.Plains;
        }
        
        private void GenerateProvinces()
        {
            // 生成省份中心点
            List<Vector2I> centers = new List<Vector2I>();
            List<int> landCells = new List<int>();
            
            // 收集所有陆地格子
            for (int x = 0; x < MapData.MAP_WIDTH; x++)
            {
                for (int y = 0; y < MapData.MAP_HEIGHT; y++)
                {
                    if (MapData.Instance.TerrainGrid[x, y] != (int)TerrainType.Ocean)
                    {
                        landCells.Add(x + y * MapData.MAP_WIDTH);
                    }
                }
            }
            
            // 随机选择中心点
            for (int i = 0; i < MapData.PROVINCE_COUNT; i++)
            {
                if (landCells.Count == 0) break;
                
                int randomIndex = _rng.RandiRange(0, landCells.Count - 1);
                int cellIndex = landCells[randomIndex];
                int cx = cellIndex % MapData.MAP_WIDTH;
                int cy = cellIndex / MapData.MAP_WIDTH;
                
                centers.Add(new Vector2I(cx, cy));
                MapData.Instance.Provinces[i].Centroid = new Vector2(cx, cy);
                
                // 移除邻近的格子，避免中心点太密集
                landCells.RemoveAt(randomIndex);
                landCells.RemoveAll(idx => {
                    int ix = idx % MapData.MAP_WIDTH;
                    int iy = idx / MapData.MAP_WIDTH;
                    return Mathf.Abs(ix - cx) < 5 && Mathf.Abs(iy - cy) < 5;
                });
            }
            
            // Voronoi图分配
            List<Vector2I>[] provinceCells = new List<Vector2I>[MapData.PROVINCE_COUNT];
            for (int i = 0; i < MapData.PROVINCE_COUNT; i++)
            {
                provinceCells[i] = new List<Vector2I>();
            }
            
            for (int x = 0; x < MapData.MAP_WIDTH; x++)
            {
                for (int y = 0; y < MapData.MAP_HEIGHT; y++)
                {
                    if (MapData.Instance.TerrainGrid[x, y] == (int)TerrainType.Ocean)
                        continue;
                    
                    // 找到最近的中心点
                    int nearestProv = -1;
                    float minDist = float.MaxValue;
                    Vector2I currentCell = new Vector2I(x, y);
                    
                    for (int i = 0; i < centers.Count; i++)
                    {
                        float dist = currentCell.DistanceSquaredTo(centers[i]);
                        if (dist < minDist)
                        {
                            minDist = dist;
                            nearestProv = i;
                        }
                    }
                    
                    if (nearestProv >= 0)
                    {
                        provinceCells[nearestProv].Add(currentCell);
                        MapData.Instance.ProvinceGrid[x, y] = nearestProv;
                    }
                }
            }
            
            // 保存格子数据
            for (int i = 0; i < MapData.PROVINCE_COUNT; i++)
            {
                MapData.Instance.Provinces[i].Cells = provinceCells[i].ToArray();
                MapData.Instance.Provinces[i].CalculateCentroid();
                
                // 设置主要地形
                if (provinceCells[i].Count > 0)
                {
                    var firstCell = provinceCells[i][0];
                    MapData.Instance.Provinces[i].Terrain = (TerrainType)MapData.Instance.TerrainGrid[firstCell.X, firstCell.Y];
                }
            }
            
            // 移除太小的省份
            ConsolidateSmallProvinces(10);
        }
        
        private void ConsolidateSmallProvinces(int minSize)
        {
            for (int i = 0; i < MapData.PROVINCE_COUNT; i++)
            {
                var province = MapData.Instance.Provinces[i];
                if (province.Cells.Length < minSize && province.Cells.Length > 0)
                {
                    // 找到最近的相邻省份
                    Vector2I cell = province.Cells[0];
                    int nearestProv = -1;
                    float minDist = float.MaxValue;
                    
                    for (int dx = -3; dx <= 3; dx++)
                    {
                        for (int dy = -3; dy <= 3; dy++)
                        {
                            int nx = cell.X + dx;
                            int ny = cell.Y + dy;
                            if (nx < 0 || nx >= MapData.MAP_WIDTH || ny < 0 || ny >= MapData.MAP_HEIGHT)
                                continue;
                            
                            int otherProvId = MapData.Instance.ProvinceGrid[nx, ny];
                            if (otherProvId >= 0 && otherProvId != i && otherProvId < MapData.PROVINCE_COUNT)
                            {
                                float dist = new Vector2I(dx, dy).LengthSquared();
                                if (dist < minDist)
                                {
                                    minDist = dist;
                                    nearestProv = otherProvId;
                                }
                            }
                        }
                    }
                    
                    // 合并到最近的省份
                    if (nearestProv >= 0)
                    {
                        foreach (var c in province.Cells)
                        {
                            MapData.Instance.ProvinceGrid[c.X, c.Y] = nearestProv;
                        }
                        var targetProv = MapData.Instance.Provinces[nearestProv];
                        var combinedCells = new List<Vector2I>(targetProv.Cells);
                        combinedCells.AddRange(province.Cells);
                        targetProv.Cells = combinedCells.ToArray();
                        province.Cells = System.Array.Empty<Vector2I>();
                    }
                }
            }
        }
        
        private void GenerateRivers()
        {
            for (int i = 0; i < RiverCount; i++)
            {
                // 寻找山脉中的源头
                Vector2I? source = FindMountainSource();
                if (!source.HasValue) continue;
                
                // 向下游走
                List<Vector2I> riverPath = new List<Vector2I>();
                Vector2I current = source.Value;
                HashSet<Vector2I> visited = new HashSet<Vector2I>();
                
                while (IsInBounds(current) && 
                       MapData.Instance.TerrainGrid[current.X, current.Y] != (int)TerrainType.Ocean &&
                       visited.Count < 100)
                {
                    riverPath.Add(current);
                    visited.Add(current);
                    
                    // 向海拔最低的方向移动（使用噪声值作为海拔代理）
                    Vector2I? next = GetLowestNeighbor(current, visited);
                    if (!next.HasValue) break;
                    
                    current = next.Value;
                }
                
                // 标记河流
                foreach (var cell in riverPath)
                {
                    int provId = MapData.Instance.ProvinceGrid[cell.X, cell.Y];
                    if (provId >= 0 && provId < MapData.PROVINCE_COUNT)
                    {
                        MapData.Instance.Provinces[provId].HasRiver = true;
                    }
                }
            }
        }
        
        private Vector2I? FindMountainSource()
        {
            for (int attempt = 0; attempt < 100; attempt++)
            {
                int x = _rng.RandiRange(0, MapData.MAP_WIDTH - 1);
                int y = _rng.RandiRange(0, MapData.MAP_HEIGHT - 1);
                
                if (MapData.Instance.TerrainGrid[x, y] == (int)TerrainType.Mountains)
                {
                    return new Vector2I(x, y);
                }
            }
            return null;
        }
        
        private Vector2I? GetLowestNeighbor(Vector2I cell, HashSet<Vector2I> visited)
        {
            Vector2I? lowest = null;
            float minNoise = float.MaxValue;
            
            Vector2I[] directions = new[]
            {
                new Vector2I(0, 1), new Vector2I(0, -1),
                new Vector2I(1, 0), new Vector2I(-1, 0)
            };
            
            foreach (var dir in directions)
            {
                Vector2I neighbor = cell + dir;
                if (!IsInBounds(neighbor) || visited.Contains(neighbor))
                    continue;
                
                float noise = _continentNoise.GetNoise2D(neighbor.X, neighbor.Y);
                if (noise < minNoise)
                {
                    minNoise = noise;
                    lowest = neighbor;
                }
            }
            
            return lowest;
        }
        
        private bool IsInBounds(Vector2I cell)
        {
            return cell.X >= 0 && cell.X < MapData.MAP_WIDTH &&
                   cell.Y >= 0 && cell.Y < MapData.MAP_HEIGHT;
        }
        
        private void CalculateNeighbors()
        {
            for (int x = 0; x < MapData.MAP_WIDTH; x++)
            {
                for (int y = 0; y < MapData.MAP_HEIGHT; y++)
                {
                    int provId = MapData.Instance.ProvinceGrid[x, y];
                    if (provId < 0) continue;
                    
                    Vector2I[] directions = new[]
                    {
                        new Vector2I(0, 1), new Vector2I(0, -1),
                        new Vector2I(1, 0), new Vector2I(-1, 0)
                    };
                    
                    foreach (var dir in directions)
                    {
                        int nx = x + dir.X;
                        int ny = y + dir.Y;
                        if (nx < 0 || nx >= MapData.MAP_WIDTH || ny < 0 || ny >= MapData.MAP_HEIGHT)
                            continue;
                        
                        int neighborProvId = MapData.Instance.ProvinceGrid[nx, ny];
                        if (neighborProvId != provId && neighborProvId >= 0)
                        {
                            if (!MapData.Instance.Provinces[provId].Neighbors.Contains(neighborProvId))
                            {
                                MapData.Instance.Provinces[provId].Neighbors.Add(neighborProvId);
                            }
                        }
                    }
                }
            }
        }
        
        private void AssignCountries()
        {
            // 生成国家颜色
            Color[] countryColors = new Color[]
            {
                new Color(0.8f, 0.2f, 0.2f),  // 红
                new Color(0.2f, 0.4f, 0.8f),  // 蓝
                new Color(0.2f, 0.7f, 0.2f),  // 绿
                new Color(0.9f, 0.8f, 0.1f),  // 黄
                new Color(0.7f, 0.2f, 0.7f),  // 紫
                new Color(0.9f, 0.5f, 0.1f),  // 橙
                new Color(0.2f, 0.7f, 0.7f),  // 青
                new Color(0.5f, 0.3f, 0.2f),  // 棕
                new Color(0.9f, 0.9f, 0.9f),  // 白
                new Color(0.2f, 0.2f, 0.2f),  // 黑
                new Color(0.9f, 0.4f, 0.5f),  // 粉
                new Color(0.4f, 0.9f, 0.4f),  // 浅绿
                new Color(0.5f, 0.2f, 0.8f),  // 靛蓝
                new Color(0.8f, 0.7f, 0.2f),  // 金
                new Color(0.6f, 0.6f, 0.6f),  // 灰
                new Color(0.4f, 0.2f, 0.4f),  // 深紫
                new Color(0.2f, 0.5f, 0.8f),  // 天蓝
                new Color(0.8f, 0.3f, 0.3f),  // 暗红
                new Color(0.3f, 0.8f, 0.5f),  // 薄荷
                new Color(0.7f, 0.4f, 0.3f)   // 土色
            };
            
            // 创建国家
            for (int i = 0; i < MapData.COUNTRY_COUNT; i++)
            {
                MapData.Instance.Countries[i] = new Country(i, $"Country_{i}", countryColors[i]);
            }
            
            // 选择首都（分散分布）
            List<int> capitalProvinces = new List<int>();
            float gridSize = Mathf.Sqrt(MapData.PROVINCE_COUNT / MapData.COUNTRY_COUNT);
            
            for (int i = 0; i < MapData.COUNTRY_COUNT; i++)
            {
                int attempts = 0;
                int capitalProv = -1;
                
                while (attempts < 100 && capitalProv < 0)
                {
                    int randomProv = _rng.RandiRange(0, MapData.PROVINCE_COUNT - 1);
                    var province = MapData.Instance.Provinces[randomProv];
                    
                    if (province.Cells.Length > 0 && !capitalProvinces.Contains(randomProv))
                    {
                        // 检查是否与其他首都距离足够远
                        bool tooClose = false;
                        foreach (var existingCapital in capitalProvinces)
                        {
                            float dist = province.Centroid.DistanceTo(
                                MapData.Instance.Provinces[existingCapital].Centroid);
                            if (dist < 20)
                            {
                                tooClose = true;
                                break;
                            }
                        }
                        
                        if (!tooClose)
                        {
                            capitalProv = randomProv;
                        }
                    }
                    attempts++;
                }
                
                if (capitalProv >= 0)
                {
                    capitalProvinces.Add(capitalProv);
                    MapData.Instance.Countries[i].CapitalProvinceId = capitalProv;
                    MapData.Instance.Provinces[capitalProv].CountryId = i;
                    MapData.Instance.Countries[i].OwnedProvinces.Add(capitalProv);
                }
            }
            
            // BFS扩张分配剩余省份
            Queue<(int provinceId, int countryId)> expansionQueue = new Queue<(int, int)>();
            bool[] assigned = new bool[MapData.PROVINCE_COUNT];
            
            for (int i = 0; i < MapData.COUNTRY_COUNT; i++)
            {
                int capital = MapData.Instance.Countries[i].CapitalProvinceId;
                if (capital >= 0)
                {
                    assigned[capital] = true;
                    foreach (var neighbor in MapData.Instance.Provinces[capital].Neighbors)
                    {
                        expansionQueue.Enqueue((neighbor, i));
                    }
                }
            }
            
            while (expansionQueue.Count > 0)
            {
                var (provId, countryId) = expansionQueue.Dequeue();
                if (provId < 0 || provId >= MapData.PROVINCE_COUNT) continue;
                if (assigned[provId]) continue;
                if (MapData.Instance.Provinces[provId].Cells.Length == 0) continue;
                
                MapData.Instance.Provinces[provId].CountryId = countryId;
                MapData.Instance.Countries[countryId].OwnedProvinces.Add(provId);
                assigned[provId] = true;
                
                foreach (var neighbor in MapData.Instance.Provinces[provId].Neighbors)
                {
                    if (!assigned[neighbor])
                    {
                        expansionQueue.Enqueue((neighbor, countryId));
                    }
                }
            }
            
            // 检测沿海省份
            for (int i = 0; i < MapData.PROVINCE_COUNT; i++)
            {
                var province = MapData.Instance.Provinces[i];
                if (province.Cells.Length == 0) continue;
                
                foreach (var cell in province.Cells)
                {
                    Vector2I[] directions = new[]
                    {
                        new Vector2I(0, 1), new Vector2I(0, -1),
                        new Vector2I(1, 0), new Vector2I(-1, 0)
                    };
                    
                    foreach (var dir in directions)
                    {
                        int nx = cell.X + dir.X;
                        int ny = cell.Y + dir.Y;
                        if (nx < 0 || nx >= MapData.MAP_WIDTH || ny < 0 || ny >= MapData.MAP_HEIGHT)
                            continue;
                        
                        if (MapData.Instance.TerrainGrid[nx, ny] == (int)TerrainType.Ocean)
                        {
                            province.IsCoastal = true;
                            break;
                        }
                    }
                    
                    if (province.IsCoastal) break;
                }
            }
        }
    }
}
