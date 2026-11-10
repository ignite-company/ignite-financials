// Device-local time, with no network or fixed server timezone.
export function getDaypartGreeting(date=new Date()){
 const hour=date.getHours();
 if(hour<12)return "Good morning";
 if(hour<18)return "Good afternoon";
 return "Good evening";
}
