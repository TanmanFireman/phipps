/*
 * Third-person rendering proxy for Phipps.
 *
 * The Qwasm client build used by the browser suppresses its local view entity
 * even when the stock chase camera is active. This non-solid server entity
 * mirrors the player's pose so the renderer receives the same model as an
 * ordinary visible entity.
 */

void() PhippsProxyThink =
{
	if (self.owner == world)
	{
		remove (self);
		return;
	}

	setorigin (self, self.owner.origin);
	self.angles_x = 0;
	self.angles_y = self.owner.v_angle_y;
	self.angles_z = 0;
	self.frame = self.owner.frame;
	self.effects = self.owner.effects;
	self.nextthink = time + 0.01;
};

void() PhippsEnsureProxy =
{
	local entity proxy;

	proxy = find (world, classname, "phipps_proxy");
	while (proxy)
	{
		if (proxy.owner == self)
			return;
		proxy = find (proxy, classname, "phipps_proxy");
	}

	proxy = spawn ();
	proxy.classname = "phipps_proxy";
	proxy.owner = self;
	proxy.movetype = MOVETYPE_NONE;
	proxy.solid = SOLID_NOT;
	setmodel (proxy, "progs/player.mdl");
	setsize (proxy, '0 0 0', '0 0 0');
	setorigin (proxy, self.origin);
	proxy.think = PhippsProxyThink;
	proxy.nextthink = time + 0.01;
};
