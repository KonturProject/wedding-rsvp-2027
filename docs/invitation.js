const countdown=document.querySelector('#countdown');
function updateCountdown(){if(!countdown)return;const end=Date.parse('2027-07-24T00:00:00+03:00'),left=end-Date.now();if(left<=0){countdown.textContent='Наш день настал ♡';return;}const days=Math.ceil(left/86400000),n=days%100,m=days%10;const word=n>=11&&n<=14?'дней':m===1?'день':m>=2&&m<=4?'дня':'дней';countdown.textContent=days+' '+word+' до встречи';}
updateCountdown();setInterval(updateCountdown,60000);
