using Godot;
using System;
using GrandStrategyGame.Map;

namespace GrandStrategyGame.Core
{
    public partial class GameManager : Node
    {
        public static GameManager Instance { get; private set; }
        
        public DateTime CurrentDate { get; private set; } = new DateTime(1800, 1, 1);
        public int PlayerCountryId { get; set; } = 0;
        public bool IsPaused { get; set; } = true;
        
        [Signal]
        public delegate void DateChangedEventHandler(string dateString);
        
        [Signal]
        public delegate void GameSpeedChangedEventHandler(int speed);
        
        private int _gameSpeed = 1; // 1 = 1天/秒
        private float _dayTimer = 0;
        private const float BASE_DAY_DURATION = 1.0f; // 基础每天的秒数
        
        public override void _Ready()
        {
            Instance = this;
            GD.Print("GameManager initialized");
            GD.Print($"Start date: {CurrentDate:yyyy-MM-dd}");
        }
        
        public override void _Process(double delta)
        {
            if (!IsPaused)
            {
                _dayTimer += (float)delta;
                
                float dayDuration = BASE_DAY_DURATION / _gameSpeed;
                
                while (_dayTimer >= dayDuration)
                {
                    _dayTimer -= dayDuration;
                    AdvanceDay();
                }
            }
        }
        
        private void AdvanceDay()
        {
            CurrentDate = CurrentDate.AddDays(1);
            
            // 每月触发一次更新
            if (CurrentDate.Day == 1)
            {
                MonthlyUpdate();
            }
            
            EmitSignal(SignalName.DateChanged, GetFormattedDate());
        }
        
        private void MonthlyUpdate()
        {
            GD.Print($"Monthly update: {CurrentDate:yyyy-MM}");
            // 这里将调用其他系统的更新
        }
        
        public void SetGameSpeed(int speed)
        {
            _gameSpeed = Mathf.Clamp(speed, 0, 5);
            
            if (_gameSpeed == 0)
            {
                IsPaused = true;
            }
            else
            {
                IsPaused = false;
            }
            
            EmitSignal(SignalName.GameSpeedChanged, _gameSpeed);
        }
        
        public void TogglePause()
        {
            IsPaused = !IsPaused;
        }
        
        public string GetFormattedDate()
        {
            return CurrentDate.ToString("yyyy年MM月dd日");
        }
    }
}
