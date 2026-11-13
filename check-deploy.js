const checkDeploy = async () => {
  for (let i = 0; i < 30; i++) {
    const res = await fetch('https://api.render.com/v1/services/srv-dbr60clg1s2s73fh4vlg/deploys?limit=1', {
      headers: { 'Authorization': 'Bearer rnd_ukUV5MdcyV4h0mHAeI1XdBcLi4SB' }
    });
    const data = await res.json();
    const deploy = data[0].deploy;
    console.log('Status:', deploy.status);
    if (deploy.status === 'live' || deploy.status === 'build_failed' || deploy.status === 'update_failed') {
      break;
    }
    await new Promise(r => setTimeout(r, 15000));
  }
};
checkDeploy();