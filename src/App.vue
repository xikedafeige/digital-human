<template>
	<div class="dashboard">
		<header class="dashboard-header">
			<div class="brand">
				<div class="brand__mark"></div>
				<div class="brand__title">
					<strong>预算绩效数智化管理研究平台</strong>
					<span>统一门户工作台</span>
				</div>
			</div>

			<div class="dashboard-header__search">
				<input type="text" placeholder="输入关键字搜索菜单" />
			</div>

			<div class="dashboard-header__actions">
				<button class="toolbar-icon" type="button" aria-label="助手入口图标">
					<img src="/design/assistant-entry.svg" alt="" />
				</button>
				<button class="toolbar-icon" type="button" aria-label="设置">
					<span class="toolbar-icon__gear"></span>
				</button>
				<button class="toolbar-icon" type="button" aria-label="安全中心">
					<span class="toolbar-icon__lock"></span>
				</button>
				<button class="feature-button" type="button">我的功能</button>
				<div class="user-badge">
					<span class="user-badge__avatar">张</span>
					<span>张三2</span>
				</div>
				<DigitalHuman />
			</div>
		</header>

		<main class="dashboard-main">
			<section class="hero-panel">
				<div class="hero-panel__header">
					<h2>系统入口</h2>
				</div>

				<div class="hero-grid">
					<article v-for="item in entryCards" :key="item.title" class="hero-card">
						<span>{{ item.title }}</span>
						<i :class="item.color"></i>
					</article>
				</div>
			</section>

			<section class="task-panel">
				<div class="task-panel__header">
					<h2>我参与的绩效任务</h2>
				</div>

				<div class="task-grid">
					<article v-for="item in taskCards" :key="item.title" class="task-card">
						<div class="task-card__top">
							<div>
								<strong>{{ item.title }}</strong>
								<span>负责人：{{ item.owner }}</span>
							</div>
							<em>{{ item.tag }}</em>
						</div>

						<div class="task-card__meta">
							<div>
								<span>是否质控</span>
								<b>是</b>
							</div>
							<div>
								<span>开始时间</span>
								<b>{{ item.start }}</b>
							</div>
							<div>
								<span>截止时间</span>
								<b>{{ item.end }}</b>
							</div>
						</div>

						<button type="button" class="task-card__enter">进入</button>
					</article>
				</div>
			</section>
		</main>
	</div>
</template>

<script setup lang="ts">
import DigitalHuman from './components/DigitalHuman/DigitalHuman.vue'

const entryCards = [
	{ title: '统计分析', color: 'is-blue' },
	{ title: '模拟实务', color: 'is-orange' },
	{ title: '项目库', color: 'is-blue' },
	{ title: '预算绩效管理', color: 'is-green' },
	{ title: '学校自评', color: 'is-purple' },
	{ title: '投标管理', color: 'is-blue' },
	{ title: '绩效支撑库', color: 'is-purple' },
	{ title: '辅助配置', color: 'is-orange' },
	{ title: '门户配置', color: 'is-blue' },
	{ title: '案例库', color: 'is-orange' },
	{ title: '系统管理', color: 'is-blue' }
]

const taskCards = [
	{
		title: '重点评价',
		owner: '张三2',
		tag: '未提交 1',
		start: '2026-02-10',
		end: '2026-03-26'
	},
	{
		title: '事后自评',
		owner: '超级管理员',
		tag: '未提交 1',
		start: '2026-01-15',
		end: '2026-02-16'
	},
	{
		title: '导入',
		owner: '张三2',
		tag: '未提交 1',
		start: '2026-01-14',
		end: '2026-02-26'
	},
	{
		title: '测试1.1.1.1.122223333',
		owner: '张三2',
		tag: '未提交 2',
		start: '2025-12-01',
		end: '2025-12-15'
	},
	{
		title: '测试1.1.1',
		owner: '张三2',
		tag: '未提交 3',
		start: '2025-12-01',
		end: '2025-12-10'
	},
	{
		title: '测试1.1.1.1',
		owner: '张三2',
		tag: '未提交 3',
		start: '2025-12-01',
		end: '2025-12-04'
	}
]
</script>

<style lang="less" scoped>
.dashboard {
	min-height: 100vh;
	padding: 10px 10px 18px;
}

.dashboard-header {
	position: sticky;
	top: 10px;
	z-index: 20;
	display: grid;
	grid-template-columns: auto minmax(220px, 1fr) auto;
	align-items: center;
	gap: 18px;
	min-height: 68px;
	padding: 10px 18px;
	border-radius: 18px;
	background: rgba(255, 255, 255, 0.92);
	border: 1px solid rgba(224, 229, 241, 0.9);
	box-shadow: 0 12px 30px rgba(191, 201, 222, 0.18);
	backdrop-filter: blur(16px);
}

.brand {
	display: flex;
	align-items: center;
	gap: 12px;
}

.brand__mark {
	width: 22px;
	height: 22px;
	border-radius: 50%;
	background:
		radial-gradient(circle at 70% 30%, #ffffff 0 16%, transparent 16%),
		conic-gradient(from 160deg, #49d054, #33b6ff, #ff4747, #49d054);
}

.brand__title {
	display: flex;
	flex-direction: column;
	gap: 3px;

	strong {
		color: #26334c;
		font-size: 16px;
		line-height: 1.2;
		font-weight: 800;
	}

	span {
		color: #9da8bf;
		font-size: 12px;
		line-height: 1;
	}
}

.dashboard-header__search {
	display: flex;
	justify-content: flex-end;

	input {
		width: min(100%, 290px);
		height: 38px;
		padding: 0 14px;
		border: 1px solid rgba(223, 228, 239, 0.95);
		border-radius: 10px;
		background: #fbfcff;
		color: #41506d;
		outline: none;

		&::placeholder {
			color: #c0c7d7;
		}
	}
}

.dashboard-header__actions {
	display: flex;
	align-items: center;
	gap: 10px;
}

.toolbar-icon {
	width: 36px;
	height: 36px;
	border: 1px solid rgba(229, 233, 242, 0.95);
	border-radius: 12px;
	background: linear-gradient(180deg, #ffffff, #f5f8fe);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;

	img {
		width: 18px;
		height: 18px;
	}
}

.toolbar-icon__gear,
.toolbar-icon__lock {
	position: relative;
	display: inline-block;
}

.toolbar-icon__gear {
	width: 16px;
	height: 16px;
	border: 2px solid #6c768e;
	border-radius: 50%;

	&::before {
		content: '';
		position: absolute;
		inset: 4px;
		border-radius: 50%;
		background: #6c768e;
	}
}

.toolbar-icon__lock {
	width: 14px;
	height: 12px;
	border: 2px solid #6c768e;
	border-radius: 3px;

	&::before {
		content: '';
		position: absolute;
		left: 50%;
		bottom: 100%;
		width: 10px;
		height: 8px;
		margin-left: -7px;
		border: 2px solid #6c768e;
		border-bottom: none;
		border-radius: 8px 8px 0 0;
	}
}

.feature-button {
	min-width: 96px;
	height: 38px;
	padding: 0 16px;
	border: none;
	border-radius: 14px;
	background: linear-gradient(180deg, #b9d8ff, #8fbaff);
	color: #ffffff;
	font-size: 14px;
	font-weight: 700;
	cursor: pointer;
}

.user-badge {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	min-width: 82px;
	padding: 0 10px 0 8px;
	height: 38px;
	border-radius: 14px;
	background: linear-gradient(180deg, #ffffff, #f6f8fd);
	border: 1px solid rgba(229, 233, 242, 0.95);
	color: #49556e;
	font-size: 14px;
	font-weight: 600;
}

.user-badge__avatar {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: linear-gradient(180deg, #ffdcb8, #f2b380);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: #7b4a1d;
	font-size: 12px;
	font-weight: 700;
}

.dashboard-main {
	display: flex;
	flex-direction: column;
	gap: 14px;
	margin-top: 10px;
	padding-right: 360px;
}

.hero-panel,
.task-panel {
	border-radius: 18px;
	background: rgba(255, 255, 255, 0.92);
	border: 1px solid rgba(226, 231, 242, 0.94);
	box-shadow: 0 16px 30px rgba(191, 201, 222, 0.12);
}

.hero-panel {
	padding: 16px 18px 18px;
	background:
		radial-gradient(circle at 20% 20%, rgba(213, 233, 255, 0.9), transparent 30%),
		radial-gradient(circle at 65% 68%, rgba(110, 154, 255, 0.28), transparent 26%),
		linear-gradient(135deg, #eef7ff 0%, #d7ecff 42%, #adcfff 100%);
}

.hero-panel__header,
.task-panel__header {
	margin-bottom: 14px;

	h2 {
		color: #27344d;
		font-size: 16px;
		line-height: 1.2;
		font-weight: 800;
	}
}

.hero-grid {
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 12px;
}

.hero-card {
	min-height: 58px;
	padding: 0 16px;
	border-radius: 10px;
	background: rgba(255, 255, 255, 0.94);
	display: flex;
	align-items: center;
	justify-content: space-between;
	color: #26334c;
	font-size: 14px;
	font-weight: 700;
	box-shadow: 0 8px 18px rgba(169, 184, 215, 0.1);

	i {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		display: inline-block;
	}

	.is-blue {
		background: linear-gradient(135deg, #688eff, #4f6ef2);
	}

	.is-orange {
		background: linear-gradient(135deg, #ffc66c, #ff9d3f);
	}

	.is-green {
		background: linear-gradient(135deg, #63e4c2, #32cfa2);
	}

	.is-purple {
		background: linear-gradient(135deg, #b88cff, #8d67ff);
	}
}

.task-panel {
	padding: 18px;
}

.task-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 18px;
}

.task-card {
	padding: 16px;
	border-radius: 12px;
	border: 1px solid rgba(231, 235, 243, 0.95);
	background: #ffffff;
}

.task-card__top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 14px;

	strong {
		display: block;
		color: #27344d;
		font-size: 15px;
		line-height: 1.3;
		font-weight: 800;
	}

	span {
		display: block;
		margin-top: 4px;
		color: #99a5bd;
		font-size: 12px;
	}

	em {
		flex: none;
		min-width: 66px;
		height: 24px;
		padding: 0 8px;
		border-radius: 0 8px 0 8px;
		background: #ff9e17;
		color: #ffffff;
		font-size: 12px;
		font-style: normal;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
}

.task-card__meta {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px;
	padding: 14px 12px;
	border-radius: 8px;
	background: #f7f8fb;

	span {
		display: block;
		color: #a2adbf;
		font-size: 12px;
		margin-bottom: 8px;
	}

	b {
		color: #28354d;
		font-size: 12px;
	}
}

.task-card__enter {
	width: 100%;
	height: 40px;
	margin-top: 12px;
	border: none;
	background: transparent;
	color: #8d98b1;
	font-size: 14px;
	font-weight: 700;
	cursor: pointer;
}

@media (max-width: 1500px) {
	.hero-grid {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
}

@media (max-width: 1280px) {
	.dashboard-main {
		padding-right: 0;
	}

	.task-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 980px) {
	.dashboard-header {
		grid-template-columns: 1fr;
	}

	.dashboard-header__search {
		justify-content: flex-start;
	}

	.dashboard-header__actions {
		flex-wrap: wrap;
	}

	.hero-grid,
	.task-grid {
		grid-template-columns: 1fr;
	}
}
</style>
