import { Card, CardContent } from "@/components/ui/card";
import type { Service } from "@shared/schema";

interface ServiceCardProps {
  service: Service;
  onClick?: () => void;
}

const ServiceCard = ({ service, onClick }: ServiceCardProps) => {
  return (
    <Card 
      className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className={`${service.color} p-8 text-white`}>
          <div className="bg-white/20 backdrop-blur-sm w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
            <i className={`${service.icon} text-3xl`}></i>
          </div>
          <h3 className="text-xl font-bold mb-3">{service.name}</h3>
          <p className="text-white/90 mb-4">{service.description}</p>
          <div className="flex items-center text-sm text-white/80">
            <i className="fas fa-clock mr-2"></i>
            <span>{service.averageDuration}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceCard;
