using Godot;

namespace GrandStrategyGame.Map
{
    public partial class MapCamera : Camera2D
    {
        [Export] public float MinZoom { get; set; } = 0.5f;
        [Export] public float MaxZoom { get; set; } = 3.0f;
        [Export] public float ZoomSpeed { get; set; } = 0.1f;
        [Export] public float PanSpeed { get; set; } = 500.0f;
        
        private Vector2 _dragStart;
        private bool _isDragging = false;
        
        public override void _Ready()
        {
            // 设置初始位置为地图中心
            Position = new Vector2(
                MapData.MAP_WIDTH * MapData.CELL_SIZE / 2,
                MapData.MAP_HEIGHT * MapData.CELL_SIZE / 2
            );
            
            // 设置缩放限制
            LimitLeft = 0;
            LimitTop = 0;
            LimitRight = MapData.MAP_WIDTH * MapData.CELL_SIZE;
            LimitBottom = MapData.MAP_HEIGHT * MapData.CELL_SIZE;
            LimitSmoothed = true;
        }
        
        public override void _Input(InputEvent @event)
        {
            // 鼠标滚轮缩放
            if (@event is InputEventMouseButton mouseButton)
            {
                if (mouseButton.ButtonIndex == MouseButton.WheelUp)
                {
                    ZoomIn();
                }
                else if (mouseButton.ButtonIndex == MouseButton.WheelDown)
                {
                    ZoomOut();
                }
                else if (mouseButton.ButtonIndex == MouseButton.Middle)
                {
                    if (mouseButton.Pressed)
                    {
                        _isDragging = true;
                        _dragStart = GetGlobalMousePosition();
                    }
                    else
                    {
                        _isDragging = false;
                    }
                }
            }
            
            // 拖动平移
            if (@event is InputEventMouseMotion mouseMotion && _isDragging)
            {
                Vector2 delta = _dragStart - GetGlobalMousePosition();
                Position += delta;
                _dragStart = GetGlobalMousePosition() + delta;
            }
        }
        
        public override void _Process(double delta)
        {
            // 键盘控制
            Vector2 input = Vector2.Zero;
            
            if (Input.IsActionPressed("ui_up"))
                input.Y -= 1;
            if (Input.IsActionPressed("ui_down"))
                input.Y += 1;
            if (Input.IsActionPressed("ui_left"))
                input.X -= 1;
            if (Input.IsActionPressed("ui_right"))
                input.X += 1;
            
            if (input != Vector2.Zero)
            {
                input = input.Normalized();
                Position += input * PanSpeed * (float)delta / Zoom;
            }
        }
        
        private void ZoomIn()
        {
            Vector2 newZoom = Zoom + new Vector2(ZoomSpeed, ZoomSpeed);
            Zoom = newZoom.Clamp(new Vector2(MinZoom, MinZoom), new Vector2(MaxZoom, MaxZoom));
        }
        
        private void ZoomOut()
        {
            Vector2 newZoom = Zoom - new Vector2(ZoomSpeed, ZoomSpeed);
            Zoom = newZoom.Clamp(new Vector2(MinZoom, MinZoom), new Vector2(MaxZoom, MaxZoom));
        }
        
        public void FocusOnProvince(int provinceId)
        {
            if (provinceId < 0 || provinceId >= MapData.PROVINCE_COUNT) return;
            
            var province = MapData.Instance.Provinces[provinceId];
            if (province.Cells.Length > 0)
            {
                Vector2 targetPos = province.Centroid * MapData.CELL_SIZE;
                Position = targetPos;
            }
        }
    }
}
